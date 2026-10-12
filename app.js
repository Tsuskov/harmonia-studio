const $ = selector => document.querySelector(selector);
const STORAGE_KEY = 'fl-studio-local-session-v1';
const voiceNames = ['Kick', 'Clap', 'Hi-Hat', 'Snare', 'Bass'];
const voiceTypes = ['BASS DRUM', 'CLAP', 'HI-HAT', 'SNARE', 'BASS SYNTH'];

const initial = {
  bpm: 130,
  mode: 'PAT',
  selectedPattern: 0,
  channels: voiceNames.slice(),
  patterns: [{ name: 'Pattern 1', steps: [
    [0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [4, 12], [2, 6, 10, 14]
  ] }],
  clips: [],
  volumes: Array(18).fill(70)
};

function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.channels) && Array.isArray(saved.patterns) &&
        Array.isArray(saved.clips) && Array.isArray(saved.volumes)) {
      ['808 Kick', '808 Clap', '808 HiHat', '808 Snare', '808 Astronomic'].forEach((name, i) => {
        if (saved.channels[i] === name) saved.channels[i] = voiceNames[i];
      });
      ['Helios Kick', 'Echo Clap', 'Selene Hat', 'Ares Snare', 'Aether Bass'].forEach((name, i) => {
        if (saved.channels[i] === name) saved.channels[i] = voiceNames[i];
      });
      return saved;
    }
  } catch (_) {}
  return structuredClone(initial);
}

const session = readSession();
session.selectedPattern = Math.min(session.selectedPattern || 0, session.patterns.length - 1);
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
let audio = null;
let master = null;
let noiseBuffer = null;
let timer = null;
let nextStepTime = 0;
let tick = 0;
let recording = false;
let selectedChannel = 4;

function renderSamples() {
  const samples = $('#samples');
  samples.replaceChildren();
  const query = $('#sampleSearch').value.trim().toLowerCase();
  session.channels.forEach((name, i) => {
    if (!name.toLowerCase().includes(query)) return;
    const item = document.createElement('button');
    item.className = 'sample';
    item.type = 'button';
    item.title = `${name} vorhören`;
    item.innerHTML = `<span class="cover">${String(i + 1).padStart(2, '0')}</span><span class="sample-body"><span class="name"></span><small>${voiceTypes[i] || 'SYNTH'}</small></span><span class="sample-play">▶</span>`;
    item.querySelector('.name').textContent = name;
    item.onclick = () => previewVoice(i);
    samples.append(item);
  });
}

function previewVoice(channel) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  const context = new Context();
  const output = context.createGain();
  output.gain.value = (session.volumes[1] ?? 70) / 100;
  output.connect(context.destination);
  hit(channel, context.currentTime + .01, context, output, makeNoise(context));
  setTimeout(() => context.close(), 500);
}

function renderPatternLabel() {
  const name = session.patterns[session.selectedPattern].name;
  $('#pattern').textContent = `${name} ▴`;
  $('#patternStatus').textContent = name;
  if (!$('#pianoRoll').hidden) renderPiano();
}

function renderMode() {
  $('#pat').classList.toggle('selected', session.mode === 'PAT');
  $('#song').classList.toggle('selected', session.mode === 'SONG');
}

function renderChannels() {
  const rack = $('#channels');
  rack.replaceChildren();
  const steps = session.patterns[session.selectedPattern].steps;
  session.channels.forEach((name, rowIndex) => {
    const row = document.createElement('div');
    row.className = 'channel';
    row.innerHTML = `<i class="led"></i><i class="knob"></i><i class="knob"></i><button class="assign">${rowIndex + 1} ‹</button><button class="channel-name"></button><i class="pitch"></i><div class="steps"></div>`;
    row.querySelector('.channel-name').textContent = name;
    row.querySelector('.channel-name').onclick = () => openPiano(rowIndex);
    const strip = row.querySelector('.steps');
    for (let index = 0; index < 16; index++) {
      const pad = document.createElement('button');
      pad.className = `step${steps[rowIndex]?.includes(index) ? ' on' : ''}`;
      pad.setAttribute('aria-label', `${name} Step ${index + 1}`);
      pad.setAttribute('aria-pressed', steps[rowIndex]?.includes(index) ? 'true' : 'false');
      pad.onclick = () => {
        const active = steps[rowIndex];
        if (active.includes(index)) active.splice(active.indexOf(index), 1);
        else active.push(index);
        pad.classList.toggle('on');
        pad.setAttribute('aria-pressed', active.includes(index) ? 'true' : 'false');
        save();
      };
      strip.append(pad);
    }
    rack.append(row);
  });
}

function openPiano(channel = selectedChannel) {
  selectedChannel = channel;
  $('#pianoRoll').hidden = false;
  renderPiano();
}

function renderPiano() {
  const pattern = session.patterns[session.selectedPattern];
  pattern.notes ??= session.channels.map(() => []);
  while (pattern.notes.length < session.channels.length) pattern.notes.push([]);
  const notes = pattern.notes[selectedChannel];
  $('#pianoTitle').textContent = `Piano roll · ${session.channels[selectedChannel]}`;
  $('#pianoRows').replaceChildren();
  const keys = ['C4', 'C♯4', 'D4', 'D♯4', 'E4', 'F4', 'F♯4', 'G4', 'G♯4', 'A4', 'A♯4', 'B4'];
  for (let pitch = 11; pitch >= 0; pitch--) {
    const row = document.createElement('div');
    row.className = 'piano-row';
    const key = document.createElement('div');
    key.className = `piano-key${keys[pitch].includes('♯') ? ' black' : ''}`;
    key.textContent = keys[pitch];
    row.append(key);
    for (let step = 0; step < 16; step++) {
      const cell = document.createElement('button');
      const active = notes.some(note => note.step === step && note.pitch === pitch);
      cell.className = `note-cell${active ? ' on' : ''}`;
      cell.setAttribute('aria-label', `${keys[pitch]} Step ${step + 1}`);
      cell.setAttribute('aria-pressed', active ? 'true' : 'false');
      cell.onclick = () => {
        const index = notes.findIndex(note => note.step === step && note.pitch === pitch);
        if (index < 0) notes.push({ step, pitch });
        else notes.splice(index, 1);
        cell.classList.toggle('on');
        cell.setAttribute('aria-pressed', index < 0 ? 'true' : 'false');
        save();
      };
      row.append(cell);
    }
    $('#pianoRows').append(row);
  }
}

function renderMixer() {
  const strips = $('#strips');
  strips.replaceChildren();
  for (let i = 0; i < 18; i++) {
    const name = i === 0 ? 'C' : i === 1 ? 'M' : String(i - 1);
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.innerHTML = `<div class="strip-head">${name}</div><div class="db">3<br>0<br>3<br>6<br>9<br>12<br>15<br>18<br>21<br>24<br>27<br>30<br>33<br>36<br>39</div><div class="meter-bg"></div><div class="strip-label">${i === 0 ? '' : i === 1 ? 'Master' : `Insert ${i - 1}`}</div><i class="strip-led"></i><div class="fader"><input type="range" min="0" max="100" aria-label="${i === 0 ? 'Preview' : i === 1 ? 'Master' : `Insert ${i - 1}`} Lautstärke"></div><div class="pan"></div>`;
    const fader = strip.querySelector('input');
    fader.value = session.volumes[i] ?? 70;
    fader.oninput = () => {
      session.volumes[i] = Number(fader.value);
      if (i === 1 && master) master.gain.value = session.volumes[i] / 100;
      save();
    };
    strips.append(strip);
  }
}

function renderPlaylist() {
  const tracks = $('#tracks');
  tracks.querySelectorAll('.pl-row').forEach(row => row.remove());
  for (let track = 0; track < 10; track++) {
    const row = document.createElement('div');
    row.className = 'pl-row';
    row.innerHTML = `<div class="pl-name">Track ${track + 1}</div><div class="pl-grid"></div>`;
    const grid = row.querySelector('.pl-grid');
    grid.onclick = event => {
      if (event.target !== grid) return;
      const bounds = grid.getBoundingClientRect();
      const bar = Math.max(0, Math.min(11, Math.floor((event.clientX - bounds.left) / bounds.width * 12)));
      session.clips = session.clips.filter(clip => clip.track !== track || clip.bar !== bar);
      session.clips.push({ track, bar, pattern: session.selectedPattern });
      renderPlaylist();
      save();
    };
    session.clips.filter(clip => clip.track === track).forEach(clipData => {
      const clip = document.createElement('div');
      clip.className = 'clip';
      clip.style.setProperty('--x', clipData.bar);
      clip.style.setProperty('--w', 1);
      clip.textContent = session.patterns[clipData.pattern]?.name || 'Pattern';
      clip.title = 'Zum Entfernen anklicken';
      clip.onclick = event => {
        event.stopPropagation();
        session.clips.splice(session.clips.indexOf(clipData), 1);
        renderPlaylist();
        save();
      };
      grid.append(clip);
    });
    tracks.append(row);
  }
}

function makeNoise(context) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * .3), context.sampleRate);
  const values = buffer.getChannelData(0);
  for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
  return buffer;
}

function oscillator(context, output, type, frequency, endFrequency, volume, duration, at, channel) {
  const source = context.createOscillator();
  const gain = context.createGain();
  source.type = type;
  source.frequency.setValueAtTime(frequency, at);
  if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  gain.gain.setValueAtTime(Math.max(.0001, volume * (session.volumes[channel + 2] ?? 70) / 100), at);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(gain).connect(output);
  source.start(at);
  source.stop(at + duration);
}

function noise(context, output, buffer, volume, duration, at, highpass, channel) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  gain.gain.setValueAtTime(Math.max(.0001, volume * (session.volumes[channel + 2] ?? 70) / 100), at);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(filter).connect(gain).connect(output);
  source.start(at);
  source.stop(at + duration);
}

function hit(channel, at, context, output, buffer) {
  if (channel === 0) oscillator(context, output, 'sine', 145, 42, .85, .24, at, channel);
  else if (channel === 1) noise(context, output, buffer, .25, .11, at, 900, channel);
  else if (channel === 2) noise(context, output, buffer, .09, .045, at, 6500, channel);
  else if (channel === 3) {
    noise(context, output, buffer, .34, .17, at, 1400, channel);
    oscillator(context, output, 'triangle', 180, 95, .14, .12, at, channel);
  } else oscillator(context, output, 'triangle', 75, 55, .22, .16, at, channel);
}

function tone(channel, pitch, at, duration, context, output) {
  const frequency = 261.63 * Math.pow(2, pitch / 12);
  oscillator(context, output, 'sawtooth', frequency, 0, .13, duration, at, channel);
}

function patternsAt(bar) {
  return session.mode === 'PAT'
    ? [session.patterns[session.selectedPattern]]
    : session.clips.filter(clip => clip.bar === bar).map(clip => session.patterns[clip.pattern]);
}

function updateTransport(currentTick) {
  const bar = Math.floor(currentTick / 16);
  const step = currentTick % 16;
  $('#clock').textContent = `${bar + 1}:${String(Math.floor(step / 4) + 1).padStart(2, '0')}:00`;
  $('#playline').style.setProperty('--pos', bar + step / 16);
  $('#channels').querySelectorAll('.steps').forEach(strip => {
    strip.querySelectorAll('.step').forEach((pad, index) => pad.classList.toggle('active', index === step));
  });
}

function schedule() {
  if (!audio) return;
  const stepDuration = 60 / session.bpm / 4;
  while (nextStepTime < audio.currentTime + .1) {
    const bar = Math.floor(tick / 16);
    const step = tick % 16;
    patternsAt(bar).forEach(pattern => pattern?.steps.forEach((active, channel) => {
      if (active.includes(step)) hit(channel, nextStepTime, audio, master, noiseBuffer);
      pattern.notes?.[channel]?.forEach(note => {
        if (note.step === step) tone(channel, note.pitch, nextStepTime, stepDuration * .9, audio, master);
      });
    }));
    updateTransport(tick);
    tick = (tick + 1) % (session.mode === 'PAT' ? 16 : 192);
    nextStepTime += stepDuration;
  }
}

function stop() {
  clearInterval(timer);
  timer = null;
  if (audio) audio.close();
  audio = null;
  master = null;
  tick = 0;
  $('#play').textContent = '▶';
  $('#play').style.color = '';
  $('#clock').textContent = '1:01:00';
  $('#playline').style.setProperty('--pos', 0);
  $('#channels').querySelectorAll('.step').forEach(pad => pad.classList.remove('active'));
}

function play() {
  if (timer) return stop();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio = new AudioContext();
  master = audio.createGain();
  master.gain.value = (session.volumes[1] ?? 70) / 100;
  master.connect(audio.destination);
  noiseBuffer = makeNoise(audio);
  tick = 0;
  nextStepTime = audio.currentTime + .04;
  $('#play').textContent = '❚❚';
  $('#play').style.color = '#142027';
  schedule();
  timer = setInterval(schedule, 25);
}

function wavBlob(buffer) {
  const frameCount = buffer.length;
  const channelCount = buffer.numberOfChannels;
  const bytes = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(bytes);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frameCount * channelCount * 2, true);
  const channels = Array.from({ length: channelCount }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (const channel of channels) {
      const value = Math.max(-1, Math.min(1, channel[frame]));
      view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

async function exportWav() {
  stop();
  const button = $('#exportWav');
  button.disabled = true;
  button.textContent = '…';
  try {
    const bars = session.mode === 'PAT' ? 1 : Math.max(1, ...session.clips.map(clip => clip.bar + 1));
    const sampleRate = 44100;
    const seconds = bars * 4 * 60 / session.bpm + .4;
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const context = new OfflineContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    const output = context.createGain();
    output.gain.value = (session.volumes[1] ?? 70) / 100;
    output.connect(context.destination);
    const buffer = makeNoise(context);
    const stepDuration = 60 / session.bpm / 4;
    for (let index = 0; index < bars * 16; index++) {
      const bar = Math.floor(index / 16), step = index % 16;
      patternsAt(bar).forEach(pattern => pattern?.steps.forEach((active, channel) => {
        if (active.includes(step)) hit(channel, index * stepDuration, context, output, buffer);
        pattern.notes?.[channel]?.forEach(note => {
          if (note.step === step) tone(channel, note.pitch, index * stepDuration, stepDuration * .9, context, output);
        });
      }));
    }
    const rendered = await context.startRendering();
    const url = URL.createObjectURL(wavBlob(rendered));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Harmonia - ${session.mode === 'PAT' ? session.patterns[session.selectedPattern].name : 'Arrangement'}.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    button.disabled = false;
    button.textContent = '⇩';
  }
}

function saveProjectFile() {
  const data = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Harmonia Session.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadProjectFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.channels) || !data.channels.length ||
        !Array.isArray(data.patterns) || !data.patterns.length ||
        !data.patterns.every(pattern => Array.isArray(pattern.steps) &&
          pattern.steps.length === data.channels.length && pattern.steps.every(Array.isArray) &&
          (!pattern.notes || (Array.isArray(pattern.notes) && pattern.notes.every(Array.isArray)))) ||
        !Array.isArray(data.clips) ||
        !data.clips.every(clip => Number.isInteger(clip.track) && clip.track >= 0 && clip.track < 10 &&
          Number.isInteger(clip.bar) && clip.bar >= 0 && clip.bar < 12 &&
          Number.isInteger(clip.pattern) && clip.pattern >= 0 && clip.pattern < data.patterns.length) ||
        !Array.isArray(data.volumes)) throw new Error('invalid');
    stop();
    session.bpm = Math.max(40, Math.min(300, Number(data.bpm) || 130));
    session.mode = data.mode === 'SONG' ? 'SONG' : 'PAT';
    session.channels = data.channels;
    session.patterns = data.patterns;
    session.selectedPattern = Math.max(0, Math.min(data.selectedPattern || 0, data.patterns.length - 1));
    selectedChannel = Math.min(selectedChannel, data.channels.length - 1);
    session.clips = data.clips;
    session.volumes = data.volumes;
    $('#bpm').value = session.bpm;
    renderMode();
    renderPatternLabel();
    renderChannels();
  renderSamples();
    renderMixer();
    renderPlaylist();
    save();
  } catch (_) {
    alert('Die Projektdatei konnte nicht geöffnet werden.');
  }
  $('#projectFile').value = '';
}

renderSamples();
$('#sampleSearch').oninput = renderSamples;
for (let bar = 1; bar <= 12; bar++) {
  const label = document.createElement('span');
  label.textContent = bar;
  $('#ruler').append(label);
}
$('#bpm').value = session.bpm;
renderMode();
renderPatternLabel();
renderChannels();
renderMixer();
renderPlaylist();

$('#play').onclick = play;
$('#stop').onclick = stop;
$('#bpm').onchange = event => {
  session.bpm = Math.max(40, Math.min(300, Number(event.target.value) || 130));
  event.target.value = session.bpm;
  save();
};
$('#pat').onclick = () => { stop(); session.mode = 'PAT'; renderMode(); save(); };
$('#song').onclick = () => { stop(); session.mode = 'SONG'; renderMode(); save(); };
$('#pattern').onclick = () => {
  session.selectedPattern = (session.selectedPattern + 1) % session.patterns.length;
  renderPatternLabel();
  renderChannels();
  renderSamples();
  save();
};
$('#addPattern').onclick = () => {
  session.selectedPattern = session.patterns.length;
  session.patterns.push({
    name: `Pattern ${session.selectedPattern + 1}`,
    steps: session.channels.map(() => []),
    notes: session.channels.map(() => [])
  });
  renderPatternLabel();
  renderChannels();
  save();
};
$('#addChannel').onclick = () => {
  session.channels.push(`Sampler ${session.channels.length + 1}`);
  session.patterns.forEach(pattern => {
    pattern.steps.push([]);
    pattern.notes?.push([]);
  });
  renderChannels();
  renderSamples();
  save();
};
$('#exportWav').onclick = exportWav;
$('#openPiano').onclick = () => openPiano();
$('#closePiano').onclick = () => { $('#pianoRoll').hidden = true; };
$('#saveProject').onclick = saveProjectFile;
$('#loadProject').onclick = () => $('#projectFile').click();
$('#projectFile').onchange = event => loadProjectFile(event.target.files[0]);
$('#record').onclick = () => {
  recording = !recording;
  $('#record').classList.toggle('recOn', recording);
  $('#record').setAttribute('aria-pressed', recording ? 'true' : 'false');
  if (recording && !timer) play();
};
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    play();
  }
  const channel = Number(event.code.replace('Digit', '')) - 1;
  if (!recording || !timer || !Number.isInteger(channel) || channel < 0 || channel >= session.channels.length) return;
  const active = session.patterns[session.selectedPattern].steps[channel];
  const step = (tick + 15) % 16;
  if (!active.includes(step)) active.push(step);
  hit(channel, audio.currentTime, audio, master, noiseBuffer);
  renderChannels();
  save();
});
document.querySelectorAll('.browser-tabs button').forEach(button => {
  button.onclick = () => {
    document.querySelectorAll('.browser-tabs button').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
  };
});
