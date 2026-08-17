#!/usr/bin/env node
/**
 * Google Play, so weit LexiPulse es braucht.
 *
 *   node werkzeug/play.mjs stand     was gerade in den Spuren und im Eintrag steht
 *   node werkzeug/play.mjs alles     Paket, Eintrag und Bilder in einem Zug, dann abgeben
 *
 * Warum ein einziger Befehl fuer alles: Bei Play ist eine Aenderung eine
 * Transaktion. Alles Geschriebene haengt an einem "edit", und erst das Uebergeben
 * macht es wirksam. Zwei Aufrufe waeren zwei Transaktionen, von denen die erste
 * verfaellt — das sieht wie Erfolg aus und aendert nichts.
 *
 * Kennungen kommen aus `.env.local`; das Dienstkonto liegt ausserhalb des Baums.
 */

import { createSign } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

function umgebung() {
  const werte = { ...process.env };
  const datei = join(WURZEL, '.env.local');
  if (existsSync(datei)) {
    for (const zeile of readFileSync(datei, 'utf8').split(/\r?\n/)) {
      const i = zeile.indexOf('=');
      if (i > 0 && !zeile.trimStart().startsWith('#')) {
        werte[zeile.slice(0, i).trim()] ??= zeile.slice(i + 1).trim();
      }
    }
  }
  for (const name of ['PLAY_SERVICE_ACCOUNT', 'PLAY_PACKAGE']) {
    if (!werte[name]) throw new Error(`${name} fehlt in .env.local`);
  }
  return werte;
}

const ENV = umgebung();
const PAKET = ENV.PLAY_PACKAGE;
const AAB = process.env.PLAY_AAB ?? 'C:/Users/domen/Documents/mc-build/lexipulse-android/lexipulse-1.1.0.aab';

async function zugang() {
  const konto = JSON.parse(readFileSync(ENV.PLAY_SERVICE_ACCOUNT, 'utf8'));
  const jetzt = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const daten =
    `${b64({ alg: 'RS256', typ: 'JWT' })}.` +
    b64({
      iss: konto.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: jetzt,
      exp: jetzt + 3600,
    });
  const signatur = createSign('RSA-SHA256').update(daten).sign(konto.private_key, 'base64url');
  const antwort = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${daten}.${signatur}`,
    }),
  });
  if (!antwort.ok) throw new Error(`Token: ${antwort.status} ${await antwort.text()}`);
  return (await antwort.json()).access_token;
}

const TOKEN = await zugang();
const BASIS = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

async function api(pfad, optionen = {}) {
  const antwort = await fetch(`${BASIS}/${PAKET}${pfad}`, {
    ...optionen,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(optionen.body && !optionen.headers ? { 'Content-Type': 'application/json' } : {}),
      ...(optionen.headers ?? {}),
    },
  });
  const text = await antwort.text();
  const daten = text ? JSON.parse(text) : null;
  if (!antwort.ok) {
    throw new Error(
      `${optionen.method ?? 'GET'} ${pfad}: ${antwort.status} ${daten?.error?.message ?? text.slice(0, 200)}`,
    );
  }
  return daten;
}

/** Ein Upload geht an einen anderen Host als der Rest der Schnittstelle. */
async function hochladen(pfad, daten, typ) {
  const url =
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PAKET}${pfad}` +
    (pfad.includes('?') ? '&' : '?') + 'uploadType=media';
  const antwort = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': typ },
    body: daten,
  });
  const text = await antwort.text();
  if (!antwort.ok) throw new Error(`Upload ${pfad}: ${antwort.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/* ------------------------------------------------------------------ Sprachen */

/** Play-Sprachcode und der Ordner, aus dem die Texte kommen. */
const SPRACHEN = [
  { play: 'de-DE', ordner: 'de-DE', bilder: 'android-phone' },
  { play: 'en-US', ordner: 'en-US', bilder: 'en/android-phone' },
];

function text(ordner, name) {
  return readFileSync(join(WURZEL, 'store', 'metadata', ordner, name), 'utf8').replace(/\s+$/, '');
}

/* -------------------------------------------------------------------- Stand */

async function stand() {
  const edit = await api('/edits', { method: 'POST' });
  try {
    const spuren = await api(`/edits/${edit.id}/tracks`);
    for (const spur of spuren.tracks ?? []) {
      for (const r of spur.releases ?? []) {
        console.log(`  Spur ${spur.track.padEnd(12)} ${String(r.status).padEnd(11)} ${r.name ?? ''} vc=${(r.versionCodes ?? []).join(',')}`);
      }
    }
    const eintraege = await api(`/edits/${edit.id}/listings`);
    for (const l of eintraege.listings ?? []) {
      console.log(`  ${l.language}: „${l.title}" · kurz ${l.shortDescription?.length ?? 0} · lang ${l.fullDescription?.length ?? 0}`);
    }
  } finally {
    await api(`/edits/${edit.id}`, { method: 'DELETE' });
  }
}

/* --------------------------------------------------------------------- Alles */

async function alles() {
  const edit = await api('/edits', { method: 'POST' });
  console.log(`Entwurf ${edit.id} geoeffnet.`);

  // 1. Paket
  const paket = readFileSync(AAB);
  const bundle = await hochladen(`/edits/${edit.id}/bundles`, paket, 'application/octet-stream');
  console.log(`Paket hochgeladen: versionCode ${bundle.versionCode}.`);

  // 2. Eintrag und Bilder je Sprache
  for (const sprache of SPRACHEN) {
    await api(`/edits/${edit.id}/listings/${sprache.play}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: sprache.play,
        title: text(sprache.ordner, 'title.txt'),
        shortDescription: text(sprache.ordner, 'short_description.txt'),
        fullDescription: text(sprache.ordner, 'full_description.txt'),
      }),
    });

    // Erst wegraeumen: Play haengt neue Bilder sonst hinten an, und der Laden
    // zeigt weiter den alten Stand zuerst.
    // Der Plural ist kein Schreibfehler: Play kennt `phoneScreenshots` als
    // Bildart, aber `featureGraphic` im Singular. Der falsche Name kommt als
    // "Invalid value at 'image_type'" zurueck.
    for (const art of ['phoneScreenshots', 'featureGraphic']) {
      await api(`/edits/${edit.id}/listings/${sprache.play}/${art}`, { method: 'DELETE' });
    }

    const ordner = join(WURZEL, 'store', 'screenshots', ...sprache.bilder.split('/'));
    const dateien = readdirSync(ordner).filter((n) => n.endsWith('.png')).sort();
    for (const name of dateien) {
      await hochladen(
        `/edits/${edit.id}/listings/${sprache.play}/phoneScreenshots`,
        readFileSync(join(ordner, name)),
        'image/png',
      );
    }

    const grafik = sprache.play === 'de-DE'
      ? join(WURZEL, 'store', 'screenshots', 'play-feature-graphic.png')
      : join(WURZEL, 'store', 'screenshots', 'en', 'play-feature-graphic.png');
    await hochladen(
      `/edits/${edit.id}/listings/${sprache.play}/featureGraphic`,
      readFileSync(grafik),
      'image/png',
    );
    console.log(`${sprache.play}: Eintrag geschrieben, ${dateien.length} Bilder und die Grafik.`);
  }

  // 3. Produktionsspur auf das neue Paket
  await api(`/edits/${edit.id}/tracks/production`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      track: 'production',
      releases: [
        {
          name: '1.1.0',
          versionCodes: [String(bundle.versionCode)],
          status: 'completed',
          releaseNotes: SPRACHEN.map((s) => ({
            language: s.play,
            text: text(s.ordner, 'release_notes.txt'),
          })),
        },
      ],
    }),
  });
  console.log('Produktionsspur gesetzt.');

  // 4. Uebergeben. Ohne diesen Schritt verfaellt der Entwurf und nichts davon
  //    ist je passiert.
  const fertig = await api(`/edits/${edit.id}:commit`, { method: 'POST' });
  console.log(`Uebergeben: ${JSON.stringify(fertig)}`);
}

const befehle = { stand, alles };
const befehl = process.argv[2];
if (!befehle[befehl]) {
  console.error(`Befehle: ${Object.keys(befehle).join(', ')}`);
  process.exit(1);
}
await befehle[befehl]();
