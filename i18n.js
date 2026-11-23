/* Translations. English text is the key; Dutch is the default language.
   tr('Hello {name}', { name }) returns the text in the chosen language with {placeholders} filled in. */
'use strict';

const NL = {
  // general
  'Today': 'Vandaag', 'Yesterday': 'Gisteren', 'Overview': 'Overzicht', 'Settings': 'Instellingen',
  'Back to today': 'Terug naar vandaag', 'Back to now': 'Terug naar nu',
  'Cancel': 'Annuleren', 'Save': 'Opslaan', 'Clear': 'Wissen', 'Done': 'Klaar', 'Copy': 'Kopiëren',
  'Continue': 'Verder', 'Connect': 'Koppelen', 'Restore': 'Terugzetten', 'Turn on': 'Aanzetten',
  'One moment…': 'Even geduld…', 'Daily Tracker': 'Dagtracker',
  'Me': 'Ik', 'me': 'ik', 'you': 'jij', 'Both': 'Beiden', 'Partner': 'Partner', 'partner': 'partner',
  'Week': 'Week', 'Month': 'Maand', 'Year': 'Jaar',

  // today
  'Food': 'Eten', 'Mood': 'Stemming', 'Drinks': 'Drankjes', 'Weight': 'Gewicht',
  'Food score': 'Eetscore', 'Tap again to clear': 'Tik nog eens om te wissen',
  'How did you eat?': 'Hoe heb je gegeten?', 'How did you feel?': 'Hoe voelde je je?',
  'All meals within the Schijf van Vijf, veg + fruit, no snacks outside it.': 'Alle maaltijden binnen de Schijf van Vijf, groente + fruit, geen snacks erbuiten.',
  'Mostly good, one small extra.': 'Grotendeels goed, één kleine uitschieter.',
  'Mixed: one meal or several snacks outside the Schijf.': 'Wisselend: één maaltijd of een paar snacks buiten de Schijf.',
  'Mostly fast food, sweets or takeaway.': 'Vooral fastfood, snoep of afhaal.',
  'Off the rails all day.': 'De hele dag ontspoord.',
  'Bad day': 'Slechte dag', 'Not great': 'Niet zo goed', 'Okay': 'Oké', 'Good': 'Goed', 'Great': 'Top',
  'Beer': 'Bier', 'Wine': 'Wijn', 'Liquor': 'Sterke drank',
  'glass, bottle or can': 'glas, flesje of blikje', 'glass': 'glas', 'shot or mixed drink': 'shotje of mixdrankje',
  '{n} today': '{n} vandaag', 'None': 'Geen', 'No drinks': 'Geen drankjes', 'same day': 'zelfde dag',
  '{d} since last': '{d} sinds vorige keer', 'Not weighed': 'Niet gewogen', 'Not weighed · last {w}': 'Niet gewogen · laatst {w}',
  'Change': 'Wijzigen', 'Add weight': 'Gewicht invullen',
  'Tip: weigh at the same moment each day, e.g. in the morning before breakfast.': 'Tip: weeg op hetzelfde moment, bijvoorbeeld ’s ochtends voor het ontbijt.',

  // overview
  'Your week': 'Jouw week', 'Calendar': 'Kalender', 'Every day': 'Elke dag', 'Per month': 'Per maand', 'Summary': 'Samenvatting',
  'Dry': 'Droog',
  'avg food ({a}/{b} days)': 'gem. eten ({a}/{b} dagen)', 'avg mood ({a}/{b} days)': 'gem. stemming ({a}/{b} dagen)',
  'alcohol-free (of days logged)': 'alcoholvrij (van ingevulde dagen)',
  'weight, {d} kg in this period': 'gewicht, {d} kg in deze periode', 'latest weight': 'laatste gewicht',
  '{n} drinks in total': '{n} drankjes in totaal', 'No weight logged in this period.': 'Geen gewicht ingevuld in deze periode.',
  'Left half: {a} · right half: {b}': 'Linkerhelft: {a} · rechterhelft: {b}',
  'Colour = {m} score. Small number = drinks that day.': 'Kleur = score voor {m}. Klein getal = drankjes die dag.',
  'One row per month, one square per day, coloured by {m} score. Tap a month to open it.': 'Eén rij per maand, één vakje per dag, gekleurd op {m}. Tik op een maand om die te openen.',

  // settings: data
  '1 day': '1 dag', '{n} days': '{n} dagen',
  'Your data': 'Jouw gegevens', 'Download backup (JSON)': 'Back-up downloaden (JSON)', 'Download spreadsheet (CSV)': 'Spreadsheet downloaden (CSV)',
  'Restore from backup': 'Back-up terugzetten', 'Delete all data': 'Alles wissen', 'Food score guide': 'Uitleg eetscore',
  '{nd} logged, stored on this phone and online. Keep your key (Share card → More options) to get them back on a new phone.':
    '{nd} ingevuld, opgeslagen op deze telefoon en online. Bewaar je sleutel (Delen → Meer opties) om ze op een nieuwe telefoon terug te krijgen.',
  '{nd} logged, stored only on this phone. Download a backup now and then: clearing Chrome\'s site data or uninstalling the app erases it.':
    '{nd} ingevuld, alleen opgeslagen op deze telefoon. Maak af en toe een back-up: als je de sitegegevens van Chrome wist of de app verwijdert, is alles weg.',
  'That file is not a valid backup.': 'Dat bestand is geen geldige back-up.',
  'That file is not a Daily Tracker backup.': 'Dat bestand is geen back-up van deze app.',
  'Restore backup?': 'Back-up terugzetten?',
  'This replaces everything on this phone with the backup ({n} days). This can\'t be undone.': 'Alles op deze telefoon wordt vervangen door de back-up ({n} dagen). Dit kan niet ongedaan worden.',
  'Backup restored.': 'Back-up teruggezet.',
  'Delete all data?': 'Alles wissen?',
  'This erases every day you logged, from this phone and from the online database, and turns sharing off. Download a backup first if you might want it back.':
    'Hiermee wis je alle ingevulde dagen, van deze telefoon én online, en gaat delen uit. Maak eerst een back-up als je ze misschien terug wilt.',
  'This erases every day you logged from this phone. Download a backup first if you might want it back.':
    'Hiermee wis je alle ingevulde dagen van deze telefoon. Maak eerst een back-up als je ze misschien terug wilt.',
  'Type DELETE': 'Typ WISSEN', 'Delete everything': 'Alles wissen', 'All data deleted.': 'Alles is gewist.',
  'No internet: online data not erased yet. Try again when online.': 'Geen internet: online gegevens nog niet gewist. Probeer het opnieuw als je online bent.',

  // sync / sharing
  'Syncing…': 'Bezig met synchroniseren…',
  'Offline. Changes are saved on this phone and sync later.': 'Offline. Wijzigingen staan op deze telefoon en worden later gesynchroniseerd.',
  'Sync problem: {e}': 'Probleem met synchroniseren: {e}', 'Last synced {t}': 'Laatst gesynchroniseerd {t}',
  'No internet connection. Try again later.': 'Geen internetverbinding. Probeer het later opnieuw.',
  "Didn't work: {e}": 'Dat lukte niet: {e}',
  'Share with your partner': 'Delen met je partner',
  'Turn on sharing to see each other\'s days in the overview. Your days are then also stored online, so they are safe if you lose your phone. No email or password needed.':
    'Zet delen aan om elkaars dagen in het overzicht te zien. Je dagen worden dan ook online bewaard, dus ze zijn veilig als je je telefoon kwijtraakt. Geen e-mail of wachtwoord nodig.',
  'Turn on sharing': 'Delen aanzetten', 'I already use the app on another phone': 'Ik gebruik de app al op een andere telefoon',
  'You are “{n}”.': 'Je bent “{n}”.', 'Connected with': 'Gekoppeld met',
  'Create a pairing code': 'Koppelcode maken',
  'Not connected yet. One of you creates a code, the other types it in.': 'Nog niet gekoppeld. Eén van jullie maakt een code, de ander typt die in.',
  'Enter my partner\'s code': 'Code van mijn partner invullen',
  'Let my partner see my weight': 'Mijn partner mag mijn gewicht zien', 'Sync now': 'Nu synchroniseren',
  'More options': 'Meer opties', 'Show my key (to move to a new phone)': 'Mijn sleutel tonen (voor een nieuwe telefoon)',
  'Disconnect from {n}': 'Ontkoppelen van {n}', 'Turn off sharing and erase my online data': 'Delen uitzetten en mijn online gegevens wissen',
  'Turn on online sync': 'Online synchroniseren aanzetten', 'Online sync is on.': 'Online synchroniseren staat aan.',
  'Your days are then also stored online: needed for reminders and for sharing with a partner, and safe if you lose your phone. No email or password.':
    'Je dagen worden dan ook online bewaard: nodig voor herinneringen en om te delen met je partner, en veilig als je je telefoon kwijtraakt. Geen e-mail of wachtwoord.',
  'Your first name (a partner would see this)': 'Je voornaam (die ziet je partner)', 'e.g. Guido': 'bijv. Guido',
  'Your pairing code': 'Jouw koppelcode',
  'Your partner opens the app, taps Settings → Turn on sharing, then “Enter my partner\'s code”. The code works for 24 hours.':
    'Je partner opent de app, tikt op Instellingen → Delen aanzetten, en dan “Code van mijn partner invullen”. De code werkt 24 uur.',
  'Join me in Daily Tracker: open {url} , go to Settings → Turn on sharing → Enter my partner\'s code: {code}':
    'Doe mee met Dagtracker: open {url} , ga naar Instellingen → Delen aanzetten → Code van mijn partner invullen: {code}',
  'Send via…': 'Versturen via…', 'Enter your partner\'s code': 'Vul de code van je partner in',
  'Your key': 'Jouw sleutel',
  'On a new phone, choose “I already use the app on another phone” and paste this key. Keep it private: anyone with it can see and change your days.':
    'Kies op een nieuwe telefoon “Ik gebruik de app al op een andere telefoon” en plak deze sleutel. Houd hem geheim: met deze sleutel kan iemand je dagen zien en wijzigen.',
  'Key copied.': 'Sleutel gekopieerd.', 'Paste your key': 'Plak je sleutel', 'Your days are back on this phone.': 'Je dagen staan weer op deze telefoon.',
  'Use your key': 'Gebruik je sleutel',
  'On your old phone: Settings → More options → Show my key. Your days come back on this phone.':
    'Op je oude telefoon: Instellingen → Meer opties → Mijn sleutel tonen. Je dagen komen dan op deze telefoon.',
  'Disconnect': 'Ontkoppelen',
  'You stop seeing each other\'s days. Your own days stay where they are. You can connect again with a new code.':
    'Jullie zien elkaars dagen dan niet meer. Je eigen dagen blijven bewaard. Met een nieuwe code kun je opnieuw koppelen.',
  'Erase online data': 'Online gegevens wissen', 'Sharing is off. Your days are still on this phone.': 'Delen staat uit. Je dagen staan nog op deze telefoon.',
  'Turn off sharing?': 'Delen uitzetten?',
  'This erases your days from the online database and disconnects your partner. Your days stay on this phone.':
    'Hiermee worden je dagen online gewist en word je ontkoppeld van je partner. Je dagen blijven op deze telefoon.',

  // reminders
  'Reminders': 'Herinneringen',
  'Notifications are blocked. Allow them in Android Settings → Apps → Daily Tracker → Notifications.':
    'Meldingen zijn geblokkeerd. Sta ze toe in Android: Instellingen → Apps → Dagtracker → Meldingen.',
  'Add the app to your home screen first (Chrome ⋮ → Add to home screen), then open it from there to turn on reminders.':
    'Zet de app eerst op je beginscherm (Chrome ⋮ → Toevoegen aan startscherm) en open hem daarvandaan om herinneringen aan te zetten.',
  'Reminders are sent by the online service, so they arrive even when the app is closed. Turn on online sync to use them (sharing with a partner stays optional).':
    'Herinneringen worden online verstuurd, zodat ze ook komen als de app dicht is. Zet daarvoor online synchroniseren aan (delen met een partner blijft optioneel).',
  'Daily: fill in food, mood and drinks': 'Dagelijks: eten, stemming en drankjes invullen', 'Every day at': 'Elke dag om',
  'Weekly: weigh yourself': 'Wekelijks: jezelf wegen', 'Every': 'Elke', 'at': 'om',
  'No reminder if you already filled in that day.': 'Geen herinnering als je die dag al hebt ingevuld.',
  'Reminders work on this phone.': 'Herinneringen werken op deze telefoon.',
  'Notifications are blocked on this phone.': 'Meldingen zijn geblokkeerd op deze telefoon.',
  'Send a test notification': 'Testmelding sturen',
};

function lang() {
  try { return (state && state.settings && state.settings.lang) || 'nl'; } catch (e) { return 'nl'; }
}
const LOC = () => (lang() === 'nl' ? 'nl-NL' : 'en-GB');
function tr(text, vars) {
  let out = lang() === 'nl' && Object.prototype.hasOwnProperty.call(NL, text) ? NL[text] : text;
  if (lang() === 'nl' && !Object.prototype.hasOwnProperty.call(NL, text) && window.__i18nMissing) window.__i18nMissing.add(text);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
// Static texts in index.html carry data-t; their English original is kept in data-en.
function applyStatic() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-t]').forEach((node) => {
    if (!node.dataset.en) node.dataset.en = node.textContent.trim();
    node.textContent = tr(node.dataset.en);
  });
  document.title = tr('Daily Tracker');
}
