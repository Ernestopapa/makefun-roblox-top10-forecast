const fs = require('fs');
const path = require('path');

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

let seed = 12345;
function mulberry32() {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

let spare = null;
function randomNormal() {
  if (spare !== null) {
    let tmp = spare;
    spare = null;
    return tmp;
  }
  let u = 0, v = 0;
  while (u === 0) u = mulberry32();
  while (v === 0) v = mulberry32();
  let mag = Math.sqrt(-2.0 * Math.log(u));
  spare = mag * Math.sin(2.0 * Math.PI * v);
  return mag * Math.cos(2.0 * Math.PI * v);
}

const tasks = JSON.parse(fs.readFileSync(path.join(inputDir, 'task.json'), 'utf-8'));
const historyLines = fs.readFileSync(path.join(inputDir, 'history.ndjson'), 'utf-8').trim().split('\n');
const lastChart = JSON.parse(historyLines[historyLines.length - 1]);
const startingGames = lastChart.up_and_coming.map((g) => ({
    universe_id: g.universe_id,
    rank: g.rank,
    startRank: g.rank
}));

const NSIM = 2500;
const HOURS = tasks.window.slots;
const SEED = 12345;
const UNNAMED = 0.35;
const TOP_N_PER_PLACE = 60;
const MIN_P = 0.008;
const SD_SCALE = 0.8;
const GAMMA = [1.3, 1.2, 1.1, 1.0, 1.0, 0.95, 0.9, 0.9, 0.85, 0.85];


const placeCounts = Array.from({length: 10}, () => new Map());

function getVolatility(rank) {
    if (rank <= 3) return 0.45;
    if (rank <= 10) return 0.9;
    if (rank <= 20) return 1.6;
    if (rank <= 40) return 2.6;
    return 3.4;
}

for (let sim = 0; sim < NSIM; sim++) {
    const games = startingGames.map(g => ({...g, rank: g.startRank}));
    for (let h = 0; h < HOURS; h++) {
        for (const game of games) {
            const drift = game.rank <= 40 ? 0.10 : -0.14;
            const vol = getVolatility(game.rank) * SD_SCALE;
            game.rank += drift + vol * randomNormal();
            if (game.rank < 1) game.rank = 1 + (1 - game.rank) * 0.5;
        }
        const sorted = [...games].sort((a, b) => a.rank - b.rank || a.universe_id - b.universe_id);
        for (let p = 0; p < 10; p++) {
            if (p < sorted.length) {
                const game = sorted[p];
                if (game.rank <= sorted.length) {
                    const map = placeCounts[p];
                    map.set(game.universe_id, (map.get(game.universe_id) || 0) + 1);
                }
            }
        }
    }
}

const probabilities = [];
const gameTotalProb = new Map();
const gameTotalPlace = new Map();

for (let p = 0; p < 10; p++) {
    const map = placeCounts[p];
    const total = NSIM * HOURS;
    let probs = [];
    for (const [universe_id, count] of map.entries()) {
        probs.push({universe_id, p: count / total});
    }
    
    probs.sort((a, b) => b.p - a.p);
    let topProbs = probs.slice(0, TOP_N_PER_PLACE);
    
    // Apply gamma and re-normalize
    let sum = 0;
    for (let i = 0; i < topProbs.length; i++) {
        topProbs[i].p = Math.pow(topProbs[i].p, GAMMA[p]);
        sum += topProbs[i].p;
    }
    
    // Scale so sum = 1 - UNNAMED (0.65)
    for (let i = 0; i < topProbs.length; i++) {
        topProbs[i].p = (topProbs[i].p / sum) * (1 - UNNAMED);
    }
    
    // Filter MIN_P
    topProbs = topProbs.filter(item => item.p >= MIN_P);
    
    for (const item of topProbs) {
        probabilities.push({universe_id: item.universe_id, place: p + 1, p: Number(item.p.toFixed(6))});
        
        gameTotalProb.set(item.universe_id, (gameTotalProb.get(item.universe_id) || 0) + item.p);
        gameTotalPlace.set(item.universe_id, (gameTotalPlace.get(item.universe_id) || 0) + item.p * (p + 1));
    }
}

const top10 = Array.from(gameTotalProb.entries())
    .sort((a, b) => b[1] - a[1] || (gameTotalPlace.get(a[0])/a[1]) - (gameTotalPlace.get(b[0])/b[1]))
    .slice(0, 10)
    .map(entry => entry[0]);

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, tasks.output), JSON.stringify({probabilities, top10}) + '\n');
