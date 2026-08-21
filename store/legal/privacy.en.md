---
title: Privacy Policy
description: How LexiPulse handles data. In short, your documents stay on your device, there is no tracking and no user account.
lang: en
updated: 2026-08-17
---

# Privacy Policy

Last updated: 17 August 2026

This is the English translation of our German privacy policy. In case of any
discrepancy, the German version published at lexipulse.de is authoritative.

## 1. Summary

LexiPulse is built so that as little personal data as possible is created in the first
place.

- No account and no registration are required.
- Your books, PDFs, articles and notes are processed and stored exclusively on your own
  device. We do not upload them and have no access to them.
- No tracking, no analytics, no advertising and no advertising identifiers.
- No cookies beyond those strictly necessary for operation. That is why there is no
  cookie banner.
- The only feature that contacts a server at all is importing a web article by URL. See
  section 5.
- Looking a word up hands that single word to an app of your choice, on your explicit
  action. LexiPulse itself transmits nothing. See section 7.

## 2. Controller

The controller within the meaning of Art. 4(7) GDPR is:

**MenuCloud Berlin**
Owner: Domenic Moran
Heidelberger Str. 36
12059 Berlin
Germany

Phone: +49 30 767 645 46
Email: lexipulse@domenicmoran.de

We have not appointed a data protection officer because the conditions of Art. 37 GDPR
and Section 38 BDSG are not met.

## 3. Processing on your device

When you import an EPUB, a PDF, a text or Markdown file, paste text from the clipboard
or open a web article, the following happens entirely on your device:

- The file is read and converted into plain text.
- The text is split into words, prepared for display and stored in the local database.
- For a PDF, the **original file is also kept unchanged** on your device. That is the only
  way to show the pages as they were laid out, and the only way to highlight, fill in or
  sign them. You can delete it at any time by removing the document from your library.
- Whatever you add to an original page — highlights, notes, drawings, signatures, filled-in
  form fields — is likewise stored locally only. Editing and saving a PDF also runs
  entirely on your device; the file is never transmitted.
- Reading progress, bookmarks, settings and statistics are also stored locally only.

Technically the web app uses **IndexedDB** in your browser, and the mobile apps use a
local **SQLite** database inside the app's private storage on the device.

This data never leaves your device. There is no transmission to us or to any third
party. Because we have no access to it, we can neither read nor restore this content if
you delete it.

**Deletion:** Delete individual documents in the library. To remove everything at once,
clear the site data for lexipulse.de in your browser, or uninstall the mobile app or
reset its data.

## 4. Visiting lexipulse.de (hosting)

The website and web app are hosted by **Vercel Inc.**, 440 N Barranca Ave #4133, Covina,
CA 91723, USA. For users in the EU the service is provided by **Vercel Germany GmbH**.

When you access the site, Vercel processes technically necessary connection data in
server log files as our processor:

- IP address of the requesting device
- date and time of the request
- requested URL and amount of data transferred
- HTTP status code
- referrer URL, if transmitted
- browser type and operating system (user agent)

**Purpose:** delivering the site, operational security, detecting and preventing abuse
and attacks.
**Legal basis:** Art. 6(1)(f) GDPR. Our legitimate interest is the secure and reliable
operation of the service.
**Retention:** Vercel keeps these logs for a short period for abuse prevention. We do not
analyse them on a personal level and do not combine them with other data.

A data processing agreement under Art. 28 GDPR is in place with Vercel. Transfers to the
USA are covered by the EU Standard Contractual Clauses; Vercel Inc. is additionally
certified under the EU-US Data Privacy Framework.
Vercel privacy notice: https://vercel.com/legal/privacy-policy

## 5. Importing web articles by URL

When you paste a web address into LexiPulse, your browser cannot read the remote page
directly for security reasons. The web app therefore sends the address to our
`/api/extract` endpoint. That endpoint fetches the page server-side, extracts the article
text and returns only that text to your device, where it is stored locally.

- **Data processed:** the URL you entered, plus the IP address of your request as part
  of the general server logs described in section 4.
- **No storage:** the requested URL is not logged, not stored and not linked to any
  user. The extracted article text is not kept on the server; it is passed through and
  then discarded.
- **Legal basis:** Art. 6(1)(b) GDPR, because the processing is necessary to provide the
  feature you explicitly requested.
- **Note:** the operator of the remote site receives the request from our server. Your
  own IP address is not passed on to them.

If you prefer not to involve any server, use file import, clipboard import or plain text
instead. Those paths are fully offline.

## 6. Text to speech

The read-aloud feature uses the speech synthesis of your operating system or browser.
The text to be spoken is handed to that system function. Whether your device synthesises
speech locally or contacts a service run by the device manufacturer depends on your
operating system and its settings, which are outside our control. If you want to avoid
this, use LexiPulse without the read-aloud feature.

## 7. Looking a word up

In page mode you can look up a selected word. LexiPulse ships no dictionary of its own and
contacts no server for this. The word overview, meaning the word together with every
occurrence in the open document, is computed entirely on your device.

The "Look up" entry hands the selected word to an app of your choice on your explicit
action, on Android through the system's text processing function and on iOS through the
share sheet. Only with that choice does the word leave LexiPulse. What is handed over is
the word itself and nothing else: not the surrounding text, not the title of the document
and nothing about you or your device.

What the app you picked does with the word is governed by that app's privacy policy and is
outside our control. LexiPulse itself transmits nothing to any server of ours and logs
neither the word nor your use of this feature. If you would rather avoid this, use the word
overview and not the "Look up" entry.

## 8. Cookies and local storage

We set no cookies for analytics, marketing or profiling. We only use local storage that
is strictly necessary for operation:

| Storage | Content | Purpose |
|---|---|---|
| IndexedDB | imported documents, original files, highlights and form entries, reading progress, bookmarks, statistics | core functionality |
| localStorage | theme, accent colour, WPM, display settings | keeping your settings |
| Service worker cache | application files of the web app | offline use |

Access to this storage does not require consent under Section 25(2) no. 2 TDDDG because
it is strictly necessary to provide the service you explicitly requested. No cookie
banner is required and none is shown.

## 9. Purchases via the App Store and Google Play

The mobile apps are distributed through the Apple App Store and Google Play. Purchase,
payment, invoicing and licence management are handled entirely by Apple and Google.
Those companies are independent controllers within the meaning of Art. 4(7) GDPR for the
data involved.

We receive no personal purchaser data from Apple or Google. The developer consoles only
show aggregated, non-personal figures such as downloads per country or total revenue.

- Apple Media Services privacy: https://www.apple.com/legal/privacy/data/en/apple-media-services/
- Google Play privacy policy: https://policies.google.com/privacy

If you send a crash report to Apple or Google, this happens through their system
function. We only receive anonymised technical reports from it, no names and no device
identifiers.

## 10. Contacting us by email

If you write to us, we process your email address and the content of your message in
order to handle your request.

**The route your message takes.** Mail to `lexipulse@domenicmoran.de` is received by
Cloudflare Email Routing and forwarded unchanged to a Gmail mailbox. We send our reply
through Brevo's mail service so that it reaches you from the same address. These three
providers see the sender, subject and content of your message; they are listed
individually in section 11.

**Legal basis:** Art. 6(1)(b) GDPR for contract-related enquiries, otherwise Art. 6(1)(f)
GDPR with our legitimate interest in responding.
**Retention:** until the enquiry has been dealt with, then according to statutory
retention periods where applicable.

## 11. Recipients and international transfers

We use four service providers: the host from section 4 and three for the email route
described in section 10. There are no others — no analytics tool, no ad network, no
crash reporting service, no chat service.

| Provider | What for | Location |
|---|---|---|
| Vercel Inc. / Vercel Germany GmbH | hosting the website, see section 4 | USA / Germany |
| Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA | receives mail sent to `@domenicmoran.de` and forwards it (Email Routing) | USA |
| Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland | operates the Gmail mailbox holding the forwarded mail | Ireland |
| Brevo GmbH, Köpenicker Str. 126, 10179 Berlin, Germany | sends our replies | Germany |

**International transfers.** Cloudflare and Google also process email on servers
outside the EU. For Cloudflare the transfer relies on the EU standard contractual
clauses in that provider's data processing agreement; for the mailbox our contracting
party is Google Ireland Limited. If you would rather avoid this, you can reach us by
post at the address in section 2.

**Your documents are not affected.** They never leave your device and are not
transferred to any of these providers. Only what you choose to write to us by email is.

Until 18 August 2026 the email route ran on a self-hosted mail server. The statement
above applies to messages reaching us from 19 August 2026 onwards.

## 12. Your rights

Under the GDPR you have the right to:

- **access** the data we process about you (Art. 15)
- **rectification** of inaccurate data (Art. 16)
- **erasure** (Art. 17)
- **restriction of processing** (Art. 18)
- **data portability** (Art. 20)
- **object** to processing based on Art. 6(1)(f) GDPR (Art. 21)

An informal message to lexipulse@domenicmoran.de is sufficient.

**Scope:** because your documents, settings and statistics exist only on your device, we
hold no such data and cannot provide information about it. An access request can only
cover data we actually hold, for example email correspondence.

## 13. Data export under Art. 20 GDPR

LexiPulse includes an export function that saves all locally stored data as a JSON file:
library, reading progress, bookmarks, highlights, tags, settings and statistics. The
export runs entirely on your device and the file is written there directly. You can take
your data with you at any time without contacting us.

The same file can be read back on another device. That, too, happens entirely locally;
the file is never transmitted to us or to anyone else. Where you put it is your choice:
on the device, over a cable, or into a storage service you use. If you use such a
service, its privacy policy applies to the file.

The original files themselves are not included. A backup is a text file you should be able
to mail to yourself; embedded PDFs would inflate it many times over. Open the same file
again on the other device and your highlights land back where they were.

One note, because it matters: the backup file contains the **complete text** of every
document you imported, along with your notes and reading positions. It deserves the same
care as the documents themselves. Do not share it with anyone you would not show your
library to.

## 14. Right to lodge a complaint

If you believe that the processing of your personal data infringes the GDPR, you may
lodge a complaint with a supervisory authority under Art. 77 GDPR. The authority
responsible for us is:

**Berliner Beauftragte für Datenschutz und Informationsfreiheit**
Friedrichstr. 219
10969 Berlin, Germany
Phone: +49 30 13889-0
Email: mailbox@datenschutz-berlin.de
Web: https://www.datenschutz-berlin.de

## 15. Encryption

The website and all server requests use TLS exclusively. You can recognise an encrypted
connection by "https://" in the address bar and the padlock icon in your browser.

## 16. No automated decision-making

There is no automated decision-making, including profiling, within the meaning of
Art. 22 GDPR.

## 17. Children

LexiPulse is not directed at children under 16. Since we collect no data, no data set
about this age group arises on our side either.

## 18. Changes to this policy

We update this policy when the features of LexiPulse or the legal situation change. The
version published at lexipulse.de applies. The date of the last change is shown at the
top.
