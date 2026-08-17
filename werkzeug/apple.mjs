#!/usr/bin/env node
/**
 * App Store Connect, so weit LexiPulse es braucht.
 *
 * Ein Werkzeug statt mehrerer, weil die Schritte aufeinander aufbauen und jeder
 * einzelne dieselbe Fassung suchen muesste. Aufrufe:
 *
 *   node werkzeug/apple.mjs stand            was gerade da ist
 *   node werkzeug/apple.mjs zurueckziehen    laufende Einreichung zuruecknehmen
 *   node werkzeug/apple.mjs fassung 1.1      Versionsnummer der Fassung setzen
 *   node werkzeug/apple.mjs texte            Name, Untertitel, Beschreibung, Suchbegriffe
 *   node werkzeug/apple.mjs bilder           Bildschirmfotos ersetzen
 *   node werkzeug/apple.mjs bau 11           Bau an die Fassung haengen
 *   node werkzeug/apple.mjs einreichen       zur Pruefung geben
 *
 * Kennungen kommen aus `.env.local`, nie aus dem Quelltext: dieses Repo ist
 * oeffentlich, und Schluesselkennung und Aussteller identifizieren das Konto
 * auch dann, wenn die .p8 ausserhalb liegt.
 */

import { createHash, createSign } from 'node:crypto';
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
  for (const name of ['APPLE_KEY_ID', 'APPLE_ISSUER_ID', 'APPLE_KEY_PATH', 'APPLE_APP_ID']) {
    if (!werte[name]) throw new Error(`${name} fehlt in .env.local`);
  }
  return werte;
}

const ENV = umgebung();
const APP = ENV.APPLE_APP_ID;

function merkmal() {
  const jetzt = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const daten =
    `${b64({ alg: 'ES256', kid: ENV.APPLE_KEY_ID, typ: 'JWT' })}.` +
    b64({ iss: ENV.APPLE_ISSUER_ID, iat: jetzt, exp: jetzt + 900, aud: 'appstoreconnect-v1' });
  const signatur = createSign('SHA256')
    .update(daten)
    .sign({ key: readFileSync(ENV.APPLE_KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${daten}.${signatur}`;
}

const TOKEN = merkmal();

async function api(pfad, optionen = {}) {
  const antwort = await fetch(`https://api.appstoreconnect.apple.com${pfad}`, {
    ...optionen,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(optionen.headers ?? {}),
    },
  });
  const text = await antwort.text();
  const daten = text ? JSON.parse(text) : null;
  if (!antwort.ok) {
    const grund = (daten?.errors ?? [])
      .map((e) => `${e.title}${e.detail ? ` — ${e.detail}` : ''}`)
      .join(' | ');
    const fehler = new Error(`${optionen.method ?? 'GET'} ${pfad}: ${antwort.status} ${grund}`);
    fehler.status = antwort.status;
    throw fehler;
  }
  return daten;
}

/* --------------------------------------------------------------- Fassungen */

/**
 * Zustaende, in denen Apple die Fassung noch beschreiben laesst.
 *
 * `DEVELOPER_REJECTED` gehoert dazu und ist der Zustand nach einer Ruecknahme —
 * **nicht** `PREPARE_FOR_SUBMISSION`. Wer auf letzteren wartet, wartet ewig.
 */
const AENDERBAR = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
  'DEVELOPER_REMOVED_FROM_SALE',
];

const IN_PRUEFUNG = [
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'PENDING_DEVELOPER_RELEASE',
  'PROCESSING_FOR_APP_STORE',
  'READY_FOR_SALE',
];

const FELDER = 'versionString,appStoreState,releaseType,copyright';

async function fassungen() {
  return (await api(`/v1/apps/${APP}/appStoreVersions?limit=20&fields[appStoreVersions]=${FELDER}`))
    .data;
}

async function fassung(zustaende) {
  const alle = await fassungen();
  const treffer = alle.find((f) => zustaende.includes(f.attributes.appStoreState));
  if (!treffer) {
    const liste = alle.map((f) => `  ${f.attributes.versionString}: ${f.attributes.appStoreState}`);
    throw new Error(`Keine Fassung in ${zustaende.join('/')}:\n${liste.join('\n')}`);
  }
  return treffer;
}

/* ------------------------------------------------------------------ Sprachen */

/** Die beiden Sprachen und wo ihre Texte liegen. */
const SPRACHEN = [
  { asc: 'de-DE', ordner: 'de-DE' },
  { asc: 'en-US', ordner: 'en-US' },
];

function text(ordner, name) {
  return readFileSync(join(WURZEL, 'store', 'metadata', ordner, name), 'utf8').replace(/\s+$/, '');
}

/* ------------------------------------------------------------------ Befehle */

async function stand() {
  const app = (await api(`/v1/apps/${APP}?fields[apps]=name,bundleId,contentRightsDeclaration`)).data;
  console.log(`App        ${app.attributes.name} · ${app.attributes.bundleId}`);
  console.log(`Inhalte    ${app.attributes.contentRightsDeclaration ?? 'nicht gesetzt'}`);
  for (const f of await fassungen()) {
    const a = f.attributes;
    console.log(`  ${a.versionString.padEnd(6)} ${a.appStoreState.padEnd(24)} Freigabe ${a.releaseType} · Copyright ${a.copyright ?? '—'}`);
    try {
      const bau = (await api(`/v1/appStoreVersions/${f.id}/build?fields[builds]=version`)).data;
      console.log(`         Bau ${bau?.attributes?.version ?? '—'}`);
    } catch {
      console.log('         Bau —');
    }
  }
  const bauten = (await api(`/v1/builds?filter[app]=${APP}&limit=4&sort=-uploadedDate&fields[builds]=version,processingState`)).data;
  console.log(`  Bauten   ${bauten.map((b) => `${b.attributes.version} (${b.attributes.processingState})`).join(', ')}`);
}

async function zurueckziehen() {
  const f = await fassung(IN_PRUEFUNG);
  console.log(`Fassung ${f.attributes.versionString}: ${f.attributes.appStoreState}, Freigabe ${f.attributes.releaseType}.`);

  // Handbremse zuerst. Steht die Freigabe auf AFTER_APPROVAL, geht die alte
  // Fassung in der Sekunde live, in der ein Pruefer sie durchwinkt — auch
  // mitten in diesem Vorgang.
  if (f.attributes.releaseType !== 'MANUAL') {
    await api(`/v1/appStoreVersions/${f.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { id: f.id, type: 'appStoreVersions', attributes: { releaseType: 'MANUAL' } },
      }),
    });
    console.log('Freigabe auf MANUAL gestellt.');
  }

  let einreichung = null;
  try {
    einreichung = (await api(`/v1/appStoreVersions/${f.id}/appStoreVersionSubmission`))?.data;
  } catch (fehler) {
    if (fehler.status !== 404) throw fehler;
  }
  if (einreichung) {
    await api(`/v1/appStoreVersionSubmissions/${einreichung.id}`, { method: 'DELETE' });
    console.log('Einreichung zurueckgezogen (appStoreVersionSubmissions).');
  } else {
    // Neuere Einreichungen haengen nicht an der Fassung, sondern als
    // reviewSubmission an der App. Die wird nicht geloescht, sondern abbestellt.
    const offene = (await api(`/v1/apps/${APP}/reviewSubmissions?filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=5`)).data;
    if (!offene.length) throw new Error('Keine offene Einreichung gefunden.');
    for (const s of offene) {
      await api(`/v1/reviewSubmissions/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { id: s.id, type: 'reviewSubmissions', attributes: { canceled: true } },
        }),
      });
      console.log(`Einreichung ${s.id} abbestellt (reviewSubmissions).`);
    }
  }

  // Am Ergebnis messen, nicht an der Antwort des schreibenden Aufrufs.
  for (let versuch = 0; versuch < 20; versuch += 1) {
    const jetzt = (await api(`/v1/appStoreVersions/${f.id}?fields[appStoreVersions]=${FELDER}`)).data;
    if (AENDERBAR.includes(jetzt.attributes.appStoreState)) {
      console.log(`Jetzt: ${jetzt.attributes.versionString} ${jetzt.attributes.appStoreState}.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 6000));
  }
  throw new Error('Fassung ist nach der Ruecknahme nicht in einen aenderbaren Zustand gegangen.');
}

async function setzeFassung(nummer) {
  const f = await fassung(AENDERBAR);
  await api(`/v1/appStoreVersions/${f.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        id: f.id,
        type: 'appStoreVersions',
        attributes: {
          versionString: nummer,
          // Nicht als Pflichtfeld markiert und trotzdem ein Ablehnungsgrund,
          // wenn es leer bleibt. Ohne das Zeichen ©, das setzt Apple selbst.
          copyright: '2026 Domenic Moran',
          releaseType: 'AFTER_APPROVAL',
        },
      },
    }),
  });
  const nachher = (await api(`/v1/appStoreVersions/${f.id}?fields[appStoreVersions]=${FELDER}`)).data;
  console.log(`Fassung ${nachher.attributes.versionString}, Freigabe ${nachher.attributes.releaseType}, Copyright ${nachher.attributes.copyright}.`);
}

async function texte() {
  const f = await fassung(AENDERBAR);

  // Inhaltsrechte an der App, nicht an der Fassung. Die Meldung dazu lautet nur
  // "Richte die Informationen zu den Inhaltsrechten ein" und nennt kein Feld.
  await api(`/v1/apps/${APP}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        id: APP,
        type: 'apps',
        attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' },
      },
    }),
  });

  // Name und Untertitel haengen an der App-Information, nicht an der Fassung.
  const infos = (await api(`/v1/apps/${APP}/appInfos?limit=10`)).data;
  const info = infos.find((i) => AENDERBAR.includes(i.attributes.appStoreState)) ?? infos[0];

  const vorhandeneInfos = (await api(`/v1/appInfos/${info.id}/appInfoLocalizations?limit=40`)).data;
  const vorhandeneFassung = (await api(`/v1/appStoreVersions/${f.id}/appStoreVersionLocalizations?limit=40`)).data;

  for (const sprache of SPRACHEN) {
    const li = vorhandeneInfos.find((l) => l.attributes.locale === sprache.asc);
    if (!li) throw new Error(`App-Information ohne ${sprache.asc}`);
    await api(`/v1/appInfoLocalizations/${li.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: li.id,
          type: 'appInfoLocalizations',
          attributes: {
            name: text(sprache.ordner, 'title.txt'),
            subtitle: text(sprache.ordner, 'subtitle.txt'),
          },
        },
      }),
    });

    const lv = vorhandeneFassung.find((l) => l.attributes.locale === sprache.asc);
    if (!lv) throw new Error(`Fassung ohne ${sprache.asc}`);
    await api(`/v1/appStoreVersionLocalizations/${lv.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: lv.id,
          type: 'appStoreVersionLocalizations',
          attributes: {
            description: text(sprache.ordner, 'full_description.txt'),
            keywords: text(sprache.ordner, 'keywords.txt'),
          },
        },
      }),
    });

    /*
     * Versionshinweise getrennt, weil Apple sie ablehnen darf.
     *
     * Solange die App nie veroeffentlicht war, ist die naechste Fassung die
     * erste — und „Neue Funktionen" beschreibt eine Aenderung gegenueber etwas,
     * das es im Laden nicht gibt. Die Antwort lautet dann
     * „Attribute 'whatsNew' cannot be edited at this time" und trifft im selben
     * Aufruf auch Beschreibung und Suchbegriffe, wenn sie mitgeschickt werden.
     */
    try {
      await api(`/v1/appStoreVersionLocalizations/${lv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            id: lv.id,
            type: 'appStoreVersionLocalizations',
            attributes: { whatsNew: text(sprache.ordner, 'release_notes.txt') },
          },
        }),
      });
      console.log(`${sprache.asc} geschrieben, mit Versionshinweisen.`);
    } catch (fehler) {
      if (fehler.status !== 409) throw fehler;
      console.log(`${sprache.asc} geschrieben; Versionshinweise nimmt Apple bei einer Erstveroeffentlichung nicht an.`);
    }
  }

  // Gegenlesen statt der Antwort des Schreibens glauben.
  for (const l of (await api(`/v1/appInfos/${info.id}/appInfoLocalizations?limit=40`)).data) {
    if (SPRACHEN.some((s) => s.asc === l.attributes.locale)) {
      console.log(`  ${l.attributes.locale}: „${l.attributes.name}" / „${l.attributes.subtitle}"`);
    }
  }
  for (const l of (await api(`/v1/appStoreVersions/${f.id}/appStoreVersionLocalizations?limit=40`)).data) {
    if (SPRACHEN.some((s) => s.asc === l.attributes.locale)) {
      const a = l.attributes;
      console.log(`  ${a.locale}: Beschreibung ${a.description?.length ?? 0}, Suchbegriffe ${a.keywords?.length ?? 0}, Hinweise ${a.whatsNew?.length ?? '—'}`);
    }
  }
}

/* -------------------------------------------------------------- Bilder */

/** Die Groessen, die Apple fuer ein Telefon verlangt, und woher sie kommen. */
const BILDSATZ = [
  { typ: 'APP_IPHONE_67', ordner: 'ios-6.9' },
  { typ: 'APP_IPHONE_65', ordner: 'ios-6.5' },
];

function bilderAus(ordner, sprache) {
  const pfad = sprache === 'de-DE'
    ? join(WURZEL, 'store', 'screenshots', ordner)
    : join(WURZEL, 'store', 'screenshots', 'en', ordner);
  return readdirSync(pfad)
    .filter((n) => n.endsWith('.png'))
    .sort()
    .map((n) => join(pfad, n));
}

async function hochladen(satzId, datei, reihenfolge) {
  const daten = readFileSync(datei);
  const name = datei.split(/[\\/]/).pop();
  const angelegt = (
    await api('/v1/appScreenshots', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appScreenshots',
          attributes: { fileSize: daten.length, fileName: name },
          relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: satzId } } },
        },
      }),
    })
  ).data;

  for (const teil of angelegt.attributes.uploadOperations) {
    const antwort = await fetch(teil.url, {
      method: teil.method,
      headers: Object.fromEntries(teil.requestHeaders.map((h) => [h.name, h.value])),
      body: daten.subarray(teil.offset, teil.offset + teil.length),
    });
    if (!antwort.ok) throw new Error(`Upload ${name}: ${antwort.status}`);
  }

  await api(`/v1/appScreenshots/${angelegt.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        id: angelegt.id,
        type: 'appScreenshots',
        attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(daten).digest('hex') },
      },
    }),
  });
  return angelegt.id;
}

async function bilder() {
  const f = await fassung(AENDERBAR);
  const orte = (await api(`/v1/appStoreVersions/${f.id}/appStoreVersionLocalizations?limit=40`)).data;

  for (const sprache of SPRACHEN) {
    const ort = orte.find((l) => l.attributes.locale === sprache.asc);
    if (!ort) throw new Error(`Fassung ohne ${sprache.asc}`);
    const saetze = (await api(`/v1/appStoreVersionLocalizations/${ort.id}/appScreenshotSets?limit=40`)).data;

    for (const gruppe of BILDSATZ) {
      let satz = saetze.find((s) => s.attributes.screenshotDisplayType === gruppe.typ);
      if (satz) {
        // Erst leeren. Apple haengt neue Bilder sonst hinten an, und der Laden
        // zeigt dann den alten Stand zuerst.
        const alt = (await api(`/v1/appScreenshotSets/${satz.id}/appScreenshots?limit=40`)).data;
        for (const bild of alt) await api(`/v1/appScreenshots/${bild.id}`, { method: 'DELETE' });
      } else {
        satz = (
          await api('/v1/appScreenshotSets', {
            method: 'POST',
            body: JSON.stringify({
              data: {
                type: 'appScreenshotSets',
                attributes: { screenshotDisplayType: gruppe.typ },
                relationships: {
                  appStoreVersionLocalization: {
                    data: { type: 'appStoreVersionLocalizations', id: ort.id },
                  },
                },
              },
            }),
          })
        ).data;
      }

      const dateien = bilderAus(gruppe.ordner, sprache.asc);
      const kennungen = [];
      for (const [index, datei] of dateien.entries()) {
        kennungen.push(await hochladen(satz.id, datei, index));
      }
      // Reihenfolge festlegen, sonst gilt die Reihenfolge des Hochladens nur
      // zufaellig.
      await api(`/v1/appScreenshotSets/${satz.id}/relationships/appScreenshots`, {
        method: 'PATCH',
        body: JSON.stringify({ data: kennungen.map((id) => ({ type: 'appScreenshots', id })) }),
      });
      console.log(`${sprache.asc} ${gruppe.typ}: ${dateien.length} Bilder.`);
    }
  }
}

/**
 * Nachsehen, was Apple wirklich hat — vor dem Einreichen.
 *
 * Ein hochgeladenes Bild ist nicht dasselbe wie ein fertiges Bild: Apple prueft
 * die Pruefsumme im Hintergrund, und ein Fehlschlag steht nur in
 * `assetDeliveryState`. Wer nur der Antwort des Hochladens glaubt, reicht eine
 * Fassung mit halben Bildern ein.
 */
async function pruefen() {
  const f = await fassung(AENDERBAR);
  const orte = (await api(`/v1/appStoreVersions/${f.id}/appStoreVersionLocalizations?limit=40`)).data;
  let fehler = 0;

  for (const sprache of SPRACHEN) {
    const ort = orte.find((l) => l.attributes.locale === sprache.asc);
    const saetze = (await api(`/v1/appStoreVersionLocalizations/${ort.id}/appScreenshotSets?limit=40`)).data;
    for (const gruppe of BILDSATZ) {
      const satz = saetze.find((s) => s.attributes.screenshotDisplayType === gruppe.typ);
      if (!satz) {
        console.log(`  ${sprache.asc} ${gruppe.typ}: KEIN SATZ`);
        fehler += 1;
        continue;
      }
      const bilder = (await api(`/v1/appScreenshotSets/${satz.id}/appScreenshots?limit=40`)).data;
      const zustaende = {};
      for (const b of bilder) {
        const z = b.attributes.assetDeliveryState?.state ?? '?';
        zustaende[z] = (zustaende[z] ?? 0) + 1;
        if (z !== 'COMPLETE') fehler += 1;
      }
      const liste = Object.entries(zustaende).map(([z, n]) => `${n}× ${z}`).join(', ');
      console.log(`  ${sprache.asc} ${gruppe.typ}: ${bilder.length} Bilder (${liste})`);
    }
  }

  const bau = (await api(`/v1/appStoreVersions/${f.id}/build?fields[builds]=version`)).data;
  const a = f.attributes;
  console.log(`  Fassung ${a.versionString} ${a.appStoreState}, Freigabe ${a.releaseType}, Bau ${bau?.attributes?.version ?? 'KEINER'}`);
  if (!bau) fehler += 1;
  console.log(fehler ? `  ${fehler} Punkt(e) offen` : '  alles vollstaendig');
  if (fehler) process.exitCode = 1;
}

async function bau(nummer) {
  const f = await fassung(AENDERBAR);
  const bauten = (await api(`/v1/builds?filter[app]=${APP}&limit=20&sort=-uploadedDate&fields[builds]=version,processingState`)).data;
  const treffer = bauten.find((b) => b.attributes.version === String(nummer));
  if (!treffer) throw new Error(`Bau ${nummer} nicht gefunden. Da: ${bauten.map((b) => b.attributes.version).join(', ')}`);
  if (treffer.attributes.processingState !== 'VALID') {
    throw new Error(`Bau ${nummer} ist ${treffer.attributes.processingState}, nicht VALID.`);
  }
  await api(`/v1/appStoreVersions/${f.id}/relationships/build`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'builds', id: treffer.id } }),
  });
  const nachher = (await api(`/v1/appStoreVersions/${f.id}/build?fields[builds]=version`)).data;
  console.log(`Bau ${nachher.attributes.version} haengt an Fassung ${f.attributes.versionString}.`);
}

/**
 * Die Hinweise fuer die Pruefung, aus `store/metadata/review-notes.txt`.
 *
 * Sie beschreiben einen Klickweg, und ein Klickweg veraltet mit der Oberflaeche.
 * Deshalb liegen sie als Datei im Repo und nicht nur bei Apple: was dort steht,
 * laesst sich gegen die App gegenlesen.
 */
async function hinweise() {
  const f = await fassung(AENDERBAR);
  const detail = (await api(`/v1/appStoreVersions/${f.id}/appStoreReviewDetail`)).data;
  const notizen = readFileSync(join(WURZEL, 'store', 'metadata', 'review-notes.txt'), 'utf8')
    .replace(/\s+$/, '');
  await api(`/v1/appStoreReviewDetails/${detail.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { id: detail.id, type: 'appStoreReviewDetails', attributes: { notes: notizen } },
    }),
  });
  const nachher = (await api(`/v1/appStoreVersions/${f.id}/appStoreReviewDetail`)).data;
  const gleich = nachher.attributes.notes === notizen;
  console.log(`Hinweise gesetzt: ${nachher.attributes.notes.length} Zeichen, ${gleich ? 'identisch' : 'ABWEICHEND'}.`);
  if (!gleich) process.exitCode = 1;
}

async function einreichen() {
  const f = await fassung(AENDERBAR);
  const angehaengt = (await api(`/v1/appStoreVersions/${f.id}/build?fields[builds]=version`)).data;
  if (!angehaengt) throw new Error('An der Fassung haengt kein Bau.');

  const offen = (await api(`/v1/apps/${APP}/reviewSubmissions?filter[state]=READY_FOR_REVIEW&limit=5`)).data;
  let einreichung = offen[0];
  if (!einreichung) {
    einreichung = (
      await api('/v1/reviewSubmissions', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissions',
            attributes: { platform: 'IOS' },
            relationships: { app: { data: { type: 'apps', id: APP } } },
          },
        }),
      })
    ).data;
  }

  const drin = (await api(`/v1/reviewSubmissions/${einreichung.id}/items?limit=20`)).data;
  if (!drin.length) {
    await api('/v1/reviewSubmissionItems', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: einreichung.id } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: f.id } },
          },
        },
      }),
    });
  }

  await api(`/v1/reviewSubmissions/${einreichung.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { id: einreichung.id, type: 'reviewSubmissions', attributes: { submitted: true } },
    }),
  });

  const nachher = (await api(`/v1/appStoreVersions/${f.id}?fields[appStoreVersions]=${FELDER}`)).data;
  console.log(`Eingereicht: ${nachher.attributes.versionString} ${nachher.attributes.appStoreState}, Bau ${angehaengt.attributes.version}, Freigabe ${nachher.attributes.releaseType}.`);
}

/* ---------------------------------------------------------------- Aufruf */

const [befehl, wert] = process.argv.slice(2);
const befehle = {
  stand,
  zurueckziehen,
  fassung: () => setzeFassung(wert ?? '1.1'),
  texte,
  bilder,
  pruefen,
  hinweise,
  bau: () => bau(wert ?? '11'),
  einreichen,
};

if (!befehle[befehl]) {
  console.error(`Befehle: ${Object.keys(befehle).join(', ')}`);
  process.exit(1);
}
await befehle[befehl]();
