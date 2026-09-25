// Gera os SFX do jogo com o motor do sfxr.me (jsfxr) a partir de definições sfxr fixas (nada aleatório: reproduzível).
// As mesmas definições vão pra docs/sfx/sfxr-definitions.json — dá pra colar cada uma em https://sfxr.me ("deserialize") e ajustar.
const fs = require('fs');
const path = require('path');
const sfxr = require('jsfxr').sfxr;

const SQUARE = 0, SAW = 1, SINE = 2, NOISE = 3;
const BASE = { oldParams: true, wave_type: SQUARE, p_env_attack: 0, p_env_sustain: 0.3, p_env_punch: 0, p_env_decay: 0.4, p_base_freq: 0.3, p_freq_limit: 0, p_freq_ramp: 0, p_freq_dramp: 0, p_vib_strength: 0, p_vib_speed: 0, p_arp_mod: 0, p_arp_speed: 0, p_duty: 0, p_duty_ramp: 0, p_repeat_speed: 0, p_pha_offset: 0, p_pha_ramp: 0, p_lpf_freq: 1, p_lpf_ramp: 0, p_lpf_resonance: 0, p_hpf_freq: 0, p_hpf_ramp: 0, sound_vol: 0.5, sample_rate: 44100, sample_size: 16 };

// [arquivo, pico alvo (0-1), parâmetros]
const SOUNDS = {
  // --- impacto ---
  'Machado madeira 1.wav': [0.42, { wave_type: NOISE, p_env_sustain: 0.06, p_env_punch: 0.5, p_env_decay: 0.25, p_base_freq: 0.34, p_freq_ramp: -0.25, p_lpf_freq: 0.55, p_hpf_freq: 0.05 }],
  'Machado madeira 2.wav': [0.42, { wave_type: NOISE, p_env_sustain: 0.07, p_env_punch: 0.55, p_env_decay: 0.27, p_base_freq: 0.29, p_freq_ramp: -0.22, p_lpf_freq: 0.5, p_hpf_freq: 0.04 }],
  'Arvore caindo.wav': [0.5, { wave_type: NOISE, p_env_attack: 0.02, p_env_sustain: 0.22, p_env_punch: 0.6, p_env_decay: 0.55, p_base_freq: 0.24, p_freq_ramp: -0.12, p_repeat_speed: 0.45, p_pha_offset: -0.3, p_pha_ramp: -0.1, p_lpf_freq: 0.5 }],
  'Picareta pedra 1.wav': [0.42, { wave_type: NOISE, p_env_sustain: 0.05, p_env_punch: 0.7, p_env_decay: 0.22, p_base_freq: 0.52, p_freq_ramp: -0.4, p_lpf_freq: 0.9, p_hpf_freq: 0.15 }],
  'Picareta pedra 2.wav': [0.42, { wave_type: NOISE, p_env_sustain: 0.05, p_env_punch: 0.75, p_env_decay: 0.21, p_base_freq: 0.6, p_freq_ramp: -0.42, p_lpf_freq: 0.85, p_hpf_freq: 0.18 }],
  'Pedra quebrando.wav': [0.5, { wave_type: NOISE, p_env_sustain: 0.16, p_env_punch: 0.7, p_env_decay: 0.42, p_base_freq: 0.3, p_freq_ramp: -0.15, p_repeat_speed: 0.55, p_lpf_freq: 0.7, p_hpf_freq: 0.05 }],
  'Picareta minerio 1.wav': [0.36, { wave_type: SQUARE, p_env_sustain: 0.02, p_env_punch: 0.3, p_env_decay: 0.26, p_base_freq: 0.62, p_freq_ramp: -0.05, p_arp_mod: 0.35, p_arp_speed: 0.75, p_duty: 0.5, p_hpf_freq: 0.2 }],
  'Picareta minerio 2.wav': [0.36, { wave_type: SQUARE, p_env_sustain: 0.02, p_env_punch: 0.35, p_env_decay: 0.28, p_base_freq: 0.7, p_freq_ramp: -0.06, p_arp_mod: 0.3, p_arp_speed: 0.7, p_duty: 0.35, p_hpf_freq: 0.22 }],
  'Minerio quebrando.wav': [0.46, { wave_type: SAW, p_env_sustain: 0.1, p_env_punch: 0.5, p_env_decay: 0.36, p_base_freq: 0.46, p_freq_ramp: -0.3, p_pha_offset: 0.4, p_pha_ramp: -0.15, p_arp_mod: 0.4, p_arp_speed: 0.6, p_hpf_freq: 0.1 }],
  'Objeto quebrando.wav': [0.5, { wave_type: NOISE, p_env_sustain: 0.09, p_env_punch: 0.6, p_env_decay: 0.32, p_base_freq: 0.42, p_freq_ramp: -0.2, p_repeat_speed: 0.35, p_pha_offset: 0.3, p_lpf_freq: 0.8, p_hpf_freq: 0.06 }],
  'Martelo.wav': [0.4, { wave_type: SQUARE, p_env_sustain: 0.03, p_env_punch: 0.5, p_env_decay: 0.22, p_base_freq: 0.5, p_freq_ramp: -0.15, p_arp_mod: 0.25, p_arp_speed: 0.65, p_duty: 0.6, p_lpf_freq: 0.75, p_hpf_freq: 0.1 }],
  // --- ações ---
  'Espada golpe.wav': [0.32, { wave_type: NOISE, p_env_attack: 0.05, p_env_sustain: 0.05, p_env_decay: 0.28, p_base_freq: 0.56, p_freq_ramp: 0.35, p_lpf_freq: 0.85, p_hpf_freq: 0.35 }],
  'Plantar.wav': [0.36, { wave_type: SINE, p_env_sustain: 0.04, p_env_punch: 0.2, p_env_decay: 0.22, p_base_freq: 0.3, p_freq_ramp: 0.3 }],
  'Colher.wav': [0.36, { wave_type: SQUARE, p_env_sustain: 0.03, p_env_punch: 0.35, p_env_decay: 0.25, p_base_freq: 0.55, p_arp_mod: 0.35, p_arp_speed: 0.6, p_duty: 0.5, p_lpf_freq: 0.8 }],
  'Posicionar objeto.wav': [0.42, { wave_type: NOISE, p_env_sustain: 0.05, p_env_punch: 0.55, p_env_decay: 0.25, p_base_freq: 0.18, p_freq_ramp: -0.2, p_lpf_freq: 0.35 }],
  'Porta.wav': [0.32, { wave_type: SQUARE, p_env_sustain: 0.15, p_env_decay: 0.25, p_base_freq: 0.22, p_freq_ramp: 0.1, p_vib_strength: 0.3, p_vib_speed: 0.4, p_duty: 0.3, p_lpf_freq: 0.5 }],
  'Dormir.wav': [0.3, { wave_type: SINE, p_env_attack: 0.05, p_env_sustain: 0.25, p_env_decay: 0.5, p_base_freq: 0.45, p_arp_mod: 0.5, p_arp_speed: 0.35 }],
  'Bau abrindo.wav': [0.36, { wave_type: SAW, p_env_sustain: 0.1, p_env_punch: 0.2, p_env_decay: 0.3, p_base_freq: 0.25, p_freq_ramp: 0.35, p_lpf_freq: 0.6 }],
  'Fabricar.wav': [0.36, { wave_type: SQUARE, p_env_sustain: 0.2, p_env_punch: 0.3, p_env_decay: 0.45, p_base_freq: 0.35, p_freq_ramp: 0.3, p_arp_mod: 0.4, p_arp_speed: 0.5, p_duty: 0.5 }],
  'Vender.wav': [0.36, { wave_type: SAW, p_env_sustain: 0.05, p_env_punch: 0.5, p_env_decay: 0.35, p_base_freq: 0.6, p_arp_mod: 0.4, p_arp_speed: 0.55 }],
  'Desbloquear.wav': [0.34, { wave_type: SQUARE, p_env_sustain: 0.18, p_env_punch: 0.3, p_env_decay: 0.4, p_base_freq: 0.4, p_freq_ramp: 0.25, p_arp_mod: 0.3, p_arp_speed: 0.55, p_duty: 0.5 }],
  'Inimigo derrotado.wav': [0.4, { wave_type: SINE, p_env_sustain: 0.05, p_env_punch: 0.4, p_env_decay: 0.3, p_base_freq: 0.36, p_freq_ramp: -0.4, p_vib_strength: 0.2, p_vib_speed: 0.4 }],
  'Alerta horda.wav': [0.4, { wave_type: SQUARE, p_env_sustain: 0.5, p_env_decay: 0.5, p_base_freq: 0.3, p_arp_mod: -0.4, p_arp_speed: 0.5, p_vib_strength: 0.3, p_vib_speed: 0.5, p_duty: 0.5, p_lpf_freq: 0.6 }],
  'Vitoria.wav': [0.36, { wave_type: SQUARE, p_env_sustain: 0.4, p_env_punch: 0.3, p_env_decay: 0.6, p_base_freq: 0.3, p_arp_mod: 0.5, p_arp_speed: 0.3, p_duty: 0.5 }],
};

const outDir = process.argv[2];
const defs = {};
for (const [file, [target, overrides]] of Object.entries(SOUNDS)) {
  const params = { ...BASE, ...overrides };
  const wave = sfxr.toWave(params);
  const bytes = Buffer.from(wave.wav);
  // normaliza o pico (PCM 16-bit, cabeçalho de 44 bytes) pro alvo — os SFX antigos do jogo têm pico 0,13-0,3
  let peak = 0;
  for (let i = 44; i + 1 < bytes.length; i += 2) peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)));
  const gain = peak > 0 ? (target * 32767) / peak : 1;
  for (let i = 44; i + 1 < bytes.length; i += 2) bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(bytes.readInt16LE(i) * gain))), i);
  fs.writeFileSync(path.join(outDir, file), bytes);
  defs[file] = { pico: target, sfxr: params };
  console.log(file.padEnd(28), ((bytes.length - 44) / 2 / 44100).toFixed(2) + 's', 'pico bruto', (peak / 32767).toFixed(2), 'ganho', gain.toFixed(2));
}
fs.writeFileSync(process.argv[3], JSON.stringify(defs, null, 2));
