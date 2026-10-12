# Harmonia Music Studio

Ein lokales Musikstudio im Browser mit reduziertem, macOS-inspiriertem Design. `index.html` öffnen; ein Server oder eine Installation ist nicht nötig.

- Die fünf Klänge der Harmonia Sounds lassen sich in der Bibliothek vorhören und im Channel Rack als 16-Schritt-Pattern programmieren.
- Ein Klick auf den Kanalnamen öffnet die Piano Roll. Mit `+` entstehen weitere Kanäle oder Patterns; der Pattern-Knopf wechselt zwischen Patterns.
- In der Playlist setzt ein Klick einen Clip im gewählten Takt. Ein Klick auf den Clip entfernt ihn. `PAT` spielt das aktuelle Pattern als Schleife, `SONG` die Playlist.
- Tempo und Mixer-Pegel sind einstellbar. Die Leertaste startet und stoppt die Wiedergabe. Die Aufnahmetaste aktiviert Step-Eingabe für die Kanäle `1` bis `5`.
- Über die obere Leiste lassen sich WAV-Audio und JSON-Projekte exportieren. Die Session wird außerdem automatisch im Browser gespeichert.

`demo-session.json` enthält das Startprojekt, `demo-pattern.wav` einen Audioexport. Die Stimmen werden lokal synthetisiert. Externe Plugins und Mikrofonaufnahme sind derzeit nicht enthalten.
