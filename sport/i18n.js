/* Translations. English text is the key; Dutch is the default language.
   tr('Hello {name}', { name }) returns the text in the chosen language with {placeholders} filled in. */
'use strict';

const NL = {
  // navigation + general
  'Training': 'Training', 'Log': 'Logboek', 'Skills': 'Skills', 'Settings': 'Instellingen',
  'Level {n}': 'Level {n}', 'Back': 'Terug', 'Cancel': 'Annuleren', 'Close': 'Sluiten', 'Continue': 'Verder', 'Done': 'Klaar',
  'Save': 'Opslaan', 'Saved': 'Opgeslagen', 'Delete': 'Verwijderen', 'Deleted': 'Verwijderd', 'Start': 'Start', 'Stop': 'Stoppen',
  'Skip': 'Overslaan', 'Pause': 'Pauze', 'Resume': 'Verder', 'optional': 'optioneel', 'Date': 'Datum', 'Minutes': 'Minuten',
  'today': 'vandaag', 'yesterday': 'gisteren', '{n} days ago': '{n} dagen geleden',

  // train screen
  'Workout in progress': 'Training bezig', 'New workout': 'Nieuwe training', 'Where are you?': 'Waar ben je?',
  'Gym': 'Gym', 'Home': 'Thuis', 'Home, no equipment': 'Thuis', 'Bodyweight': 'Eigen gewicht', 'Run': 'Hardlopen',
  'What do you want to do?': 'Wat wil je doen?', 'How much time do you have?': 'Hoeveel tijd heb je?', 'Make my workout': 'Maak mijn training',
  'At home without equipment, pulling is done as a row under a sturdy table.': 'Thuis zonder spullen doe je de trekoefening als roeien onder een stevige tafel.',
  'Log another sport': 'Andere sport loggen', 'Last workout: {what}, {when}': 'Laatste training: {what}, {when}',
  'Run-walk': 'Hardlopen-wandelen', 'Easy run': 'Rustige duurloop', 'Intervals': 'Intervallen', 'Long run': 'Lange duurloop',
  'Other sport': 'Andere sport', 'Home workout': 'Thuistraining',
  'This week': 'Deze week', '{n} wk': '{n} wk', 'Strength': 'Kracht', 'Running': 'Hardlopen', 'guideline 150': 'richtlijn 150',
  'Week goal done. Nice!': 'Weekdoel gehaald. Top!',
  'One session to go. If it doesn’t happen, your rest token saves the streak.': 'Nog één training. Lukt dat niet, dan redt je rusttoken je reeks.',
  '{n} sessions to go, {d} days left.': 'Nog {n} trainingen, nog {d} dagen.',

  // workout
  'About {n} min': 'Ongeveer {n} min', 'started {t}': 'gestart {t}', 'Warm-up': 'Warming-up',
  'Then 1–2 light warm-up sets of your first exercise.': 'Daarna 1–2 lichte opwarmsets van je eerste oefening.',
  'Cardio': 'Cardio', 'Brisk walk or easy jog. You should still be able to talk.': 'Stevig wandelen of rustig joggen. Je kunt nog praten.',
  'Bike, rower or treadmill at an easy, steady pace.': 'Fiets, roeimachine of loopband in een rustig, gelijkmatig tempo.',
  'Finish workout': 'Training afronden', 'Stop without saving': 'Stoppen zonder opslaan', 'Rest': 'Rust',
  'Rest is over. Next set!': 'Rust voorbij. Volgende set!',
  'Main lift': 'Hoofdoefening', 'Superset': 'Superset', 'Extra superset': 'Extra superset', 'Core finisher': 'Romp als afsluiter',
  'Alternate the two, {s} s rest after each round': 'Wissel de twee af, {s} s rust na elke ronde', '{s} s rest between sets': '{s} s rust tussen de sets',
  'Heavier than last time 💪': 'Zwaarder dan vorige keer 💪', 'A bit lighter to reset, then build up again': 'Iets lichter om opnieuw op te bouwen',
  'First time: pick a weight you could lift 2–3 more times': 'Eerste keer: kies een gewicht waarmee je er nog 2–3 meer had gekund',
  'Top of the range: try the level-up test': 'Bovenkant bereikt: probeer de level-up test',
  'reps': 'herh.', 'Set done': 'Set klaar', 'level {n}': 'niveau {n}', 'Now {name}': 'Nu: {name}',
  'How many more could you have done?': 'Hoeveel had je er nog in?', 'Hold': 'Vasthouden',
  '/leg': '/been', '/side': '/kant', '/arm': '/arm', 'each way': 'elke kant op',
  'Sets × reps': 'Sets × herhalingen', 'Equipment': 'Benodigd', 'Ladder': 'Ladder', 'Level-up test': 'Level-up test', 'Swap for': 'Wisselen voor',
  'Move up when it feels easy': 'Ga door als het makkelijk voelt', 'with {kg} kg': 'met {kg} kg', 'with {x}× bodyweight': 'met {x}× je lichaamsgewicht',
  'with +{p}% bodyweight': 'met +{p}% lichaamsgewicht', 'clean reps': 'nette herhalingen',
  'How hard was it?': 'Hoe zwaar was het?', 'Easy': 'Licht', 'Moderate': 'Gemiddeld', 'Hard': 'Zwaar', 'Distance (km)': 'Afstand (km)',
  'You haven’t ticked any sets yet. Tick the sets you did, so the next workout can build on them.': 'Je hebt nog geen sets afgevinkt. Vink aan wat je gedaan hebt, dan bouwt de volgende training erop voort.',
  'Well done!': 'Goed gedaan!', 'Level up! {ladder}: next time {ex}': 'Level omhoog! {ladder}: volgende keer {ex}',
  '{ladder} mastered!': '{ladder} onder de knie!', 'New record: {ex}': 'Nieuw record: {ex}', 'First time: {ex}': 'Eerste keer: {ex}', '{n} new exercises tried': '{n} nieuwe oefeningen geprobeerd',
  'Running level {n} unlocked!': 'Hardloopniveau {n} vrijgespeeld!', 'Week goal reached!': 'Weekdoel gehaald!',
  'This week: {s} of {gs} strength, {r} of {gr} runs.': 'Deze week: {s} van {gs} kracht, {r} van {gr} hardlopen.',
  'Dagtracker will show this day as “sport: yes”.': 'In Dagtracker staat deze dag op “gesport”.',
  'Stop without saving?': 'Stoppen zonder opslaan?', 'This workout will not be logged.': 'Deze training wordt niet bewaard.',

  // run
  'Walk': 'Wandelen', 'Finish run': 'Loopje afronden', 'Plan': 'Schema', 'Done!': 'Klaar!', 'Last part': 'Laatste stuk', 'Then: {what} {t}': 'Daarna: {what} {t}',
  'Shortened to {to} min: never more than 10% longer than your longest run of the last 30 days ({l} min).': 'Ingekort tot {to} min: nooit meer dan 10% langer dan je langste loopje van de laatste 30 dagen ({l} min).',
  'Beginner programme: sessions last about 30 min.': 'Beginnersschema: een training duurt ongeveer 30 min.',
  'You ran yesterday. Beginners do best with a rest day between runs.': 'Je liep gisteren al. Als beginner werkt een rustdag ertussen het best.',
  'Run-walk programme, week {w} of 9.': 'Hardlopen-wandelen, week {w} van 9.',
  'You trained legs today, so this is an easy run instead of intervals.': 'Je hebt vandaag benen getraind, dus dit wordt een rustige loop in plaats van intervallen.',

  // other sport
  'What did you do?': 'Wat heb je gedaan?', 'e.g. football, cycling, swimming': 'bijv. voetbal, fietsen, zwemmen',

  // log
  'No workouts yet. Your first one will show up here.': 'Nog geen trainingen. Je eerste verschijnt hier.',
  'Week of {d}': 'Week van {d}', 'goal': 'doel', 'in progress': 'bezig', 'rest token': 'rusttoken', 'Tap again to delete': 'Tik nog eens om te verwijderen',

  // skills
  'Character level': 'Karakterlevel',
  'The sum of all your skill levels. A level goes up when you pass its test in a workout.': 'De som van al je skill-levels. Een level gaat omhoog als je de test haalt tijdens een training.',
  'level {n} of {m}': 'niveau {n} van {m}', 'Test: {t}': 'Test: {t}', 'Next: {t}': 'Volgende: {t}', 'Top level': 'Hoogste niveau', 'Top level reached': 'Hoogste niveau bereikt', 'Mastered!': 'Onder de knie!',
  'Needs equipment, not in home workouts': 'Heeft spullen nodig, niet in thuistrainingen',
  'Run 30 minutes without walking': '30 minuten hardlopen zonder te wandelen', 'Do 5 runs at an easy pace': '5 loopjes in rustig tempo', 'Do one run of 45 minutes or more': 'Eén loopje van 45 minuten of langer',
  'Weight tiers': 'Gewichtsniveaus', 'Fill in your weight (in Dagtracker or Settings) to see your tiers.': 'Vul je gewicht in (in Dagtracker of bij Instellingen) om je niveaus te zien.',
  'Based on your bodyweight of {kg} kg and your best set of 5+ reps.': 'Op basis van je lichaamsgewicht van {kg} kg en je beste set van 5+ herhalingen.',
  'next: {kg} kg': 'volgende: {kg} kg', 'all tiers!': 'alle niveaus!',
  'Already further? Tap the level you can do now. The app then starts there.': 'Ben je al verder? Tik op het niveau dat je nu kunt. De app begint dan daar.',
  'Squat': 'Squat', 'Deadlift': 'Deadlift', 'Bench press': 'Bankdrukken', 'Overhead press': 'Overhead press', 'Barbell row': 'Roeien met stang',
  // ladders
  'Squat (gym)': 'Squat (gym)', 'Lunge (gym)': 'Lunge (gym)', 'Hinge (gym)': 'Heupscharnier (gym)', 'Push (gym)': 'Drukken (gym)',
  'Overhead (gym)': 'Boven je hoofd (gym)', 'Row (gym)': 'Roeien (gym)', 'Vertical pull (gym)': 'Optrekken (gym)',
  'Push-up': 'Push-up', 'Dip': 'Dips', 'Pull-up': 'Optrekken', 'Single-leg squat': 'Eenbenige squat', 'Hinge (bodyweight)': 'Heupscharnier',
  'Core': 'Romp', 'Handstand': 'Handstand',

  // settings
  'Weekly goal': 'Weekdoel', 'Strength workouts': 'Krachttrainingen', 'Runs': 'Hardlooptrainingen',
  'Dutch guideline: at least 150 minutes of moderate exercise a week, with muscle-strengthening at least twice. One rest token per week covers one missed session.':
    'Beweegrichtlijn: minstens 150 minuten matig intensief bewegen per week, en minstens 2 keer spierversterkend. Eén rusttoken per week vangt één gemiste training op.',
  'About you': 'Over jou', 'Bodyweight (kg)': 'Lichaamsgewicht (kg)', 'Empty = your latest weight from Dagtracker ({kg} kg).': 'Leeg = je laatste gewicht uit Dagtracker ({kg} kg).',
  'Used for level-up tests and weight tiers.': 'Nodig voor level-up tests en gewichtsniveaus.',
  'Beginner (run-walk)': 'Beginner (lopen + wandelen)', 'I can run 30 min': 'Ik kan 30 min hardlopen',
  'Turn on “sport” in Dagtracker after a workout': 'Zet “gesport” aan in Dagtracker na een training',
  'Works on this phone, also offline. Dagtracker picks it up the next time you open it.': 'Werkt op deze telefoon, ook offline. Dagtracker neemt het over zodra je hem opent.',
  'Your data': 'Je gegevens', 'Everything is stored on this phone only. {n} workouts logged.': 'Alles staat alleen op deze telefoon. {n} trainingen gelogd.',
  'Download backup (JSON)': 'Back-up downloaden (JSON)', 'Restore from backup': 'Back-up terugzetten', 'Delete all data': 'Alle gegevens wissen',
  'Tap again to delete everything': 'Tik nog eens om alles te wissen', 'All data deleted.': 'Alle gegevens gewist.',
  'Backup restored.': 'Back-up teruggezet.', 'That file is not a Training backup.': 'Dat bestand is geen Training-back-up.',
  'Photos: Free Exercise DB (public domain)': 'Foto’s: Free Exercise DB (publiek domein)', 'Open Dagtracker': 'Dagtracker openen',

  // equipment
  'Barbell + rack': 'Stang + rek', 'Dumbbell or kettlebell': 'Dumbbell of kettlebell', 'Machine': 'Machine', 'Dumbbells': 'Dumbbells',
  'Dumbbells + box': 'Dumbbells + kist', 'Barbell': 'Stang', 'Trap bar': 'Trap bar', 'Barbell + bench': 'Stang + bank', 'Dumbbells + bench': 'Dumbbells + bank',
  'Barbell + incline bench': 'Stang + schuine bank', 'Dip bars': 'Dipstation', 'Dumbbell + bench': 'Dumbbell + bank', 'Cable': 'Kabelstation',
  'Pull-up bar': 'Optrekstang', 'Dumbbells or kettlebells': 'Dumbbells of kettlebells', 'Ab wheel': 'Ab wheel', '1 kettlebell': '1 kettlebell',
  '2 kettlebells': '2 kettlebells', '1-2 kettlebells': '1–2 kettlebells', '1 light kettlebell': '1 lichte kettlebell', 'Bench or table': 'Bank of tafel',
  'None': 'Niets', 'Bench': 'Bank (thuis: bank of stoel)', 'Low bar or table': 'Lage stang of stevige tafel', 'Pull-up bar + band': 'Optrekstang + elastiek',
  'Pull-up bar + kettlebell/belt': 'Optrekstang + kettlebell/riem', 'Parallel bars or 2 chairs': 'Brugleggers of 2 stoelen', 'Parallel bars': 'Brugleggers',
  'Gymnastic rings': 'Turnringen', 'Bench or box': 'Bank of kist', 'Door frame or pole': 'Deurpost of paal', 'Anchor for feet': 'Iets om je voeten onder te haken',
  'Bar or parallel bars': 'Stang of brugleggers', 'Parallel bars or floor': 'Brugleggers of vloer', 'Wall': 'Muur', 'Open floor / soft surface': 'Vrije ruimte, zachte ondergrond',
  'Jump rope': 'Springtouw', 'Band': 'Elastiek',
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
  document.title = tr('Training');
}
