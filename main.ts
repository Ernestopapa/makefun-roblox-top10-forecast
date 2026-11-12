import * as fs from 'node:fs';
import * as path from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR || '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Constants
const NSIM = 2500;
const SEED = 12345;
const UNNAMED = 0.12;
const TOP_N_PER_PLACE = 60;
const MIN_P = 0.002;
const SD_SCALE = 0.8;

// PRNG
let seed = SEED;
function mulberry32() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

let spare: number | null = null;
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
    let z0 = mag * Math.cos(2.0 * Math.PI * v);
    let z1 = mag * Math.sin(2.0 * Math.PI * v);
    spare = z1;
    return z0;
}

function getVolatility(rank: number) {
    if (rank <= 3) return 0.45;
    if (rank <= 10) return 0.9;
    if (rank <= 20) return 1.6;
    if (rank <= 40) return 2.6;
    return 3.4;
}

function main() {
    // Read input
    const task = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'task.json'), 'utf8'));
    if (task.places === undefined || !task.window || task.window.slots === undefined || task.output === undefined) {
        throw new Error('Invalid task.json: missing places, window.slots, or output');
    }
    const HOURS = task.window.slots;
    
    const historyRaw = fs.readFileSync(path.join(INPUT_DIR, 'history.ndjson'), 'utf8').trim();
    if (historyRaw === '') {
        throw new Error('history.ndjson is empty');
    }
    const historyLines = historyRaw.split('\n');
    const lastChart = JSON.parse(historyLines[historyLines.length - 1]);
    if (!lastChart.up_and_coming || lastChart.up_and_coming.length === 0) {
        throw new Error('last history entry has empty up_and_coming list');
    }
    const games = lastChart.up_and_coming.map((g: any, i: number) => ({
        universe_id: g.universe_id,
        rank: g.rank,
        startRank: g.rank
    }));

    // Sim
    // placeCounts[placeIndex][gameIndex]
    const gameIdToIndex = new Map(games.map((g: any, i: number) => [g.universe_id, i]));
    const placeCounts = Array.from({ length: 10 }, () => new Array(games.length).fill(0));
    
    for (let s = 0; s < NSIM; s++) {
        // Reset
        games.forEach(g => g.rank = g.startRank);
        
        for (let h = 0; h < HOURS; h++) {
            // Move
            games.forEach(g => {
                const vol = getVolatility(g.rank);
                const shift = (vol * SD_SCALE) * randomNormal();
                g.rank += shift;
                if (g.rank < 1) {
                    g.rank = 1 + (1 - g.rank) * 0.5;
                }
            });
            
            // Sort
            const sortedGames = [...games].sort((a, b) => a.rank - b.rank || a.universe_id - b.universe_id);
            
            // Count
            for (let p = 0; p < 10; p++) {
                if (p < sortedGames.length) {
                    const game = sortedGames[p];
                    if (game.rank <= sortedGames.length) {
                        const idx = gameIdToIndex.get(game.universe_id)!;
                        placeCounts[p][idx]++;
                    }
                }
            }
        }
    }
    
    // Probabilities
    const probabilities = [];
    const gameTotalProb = new Array(games.length).fill(0);
    const gameExpectedPlaceSum = new Array(games.length).fill(0);

    for (let p = 0; p < 10; p++) {
        let placeProbs = games.map((g, i) => ({
            universe_id: g.universe_id,
            p: placeCounts[p][i] / (NSIM * HOURS)
        })).filter(g => g.p > 0);
        
        // Take top 60
        placeProbs.sort((a, b) => b.p - a.p);
        let top60 = placeProbs.slice(0, TOP_N_PER_PLACE);
        
        // Scale
        const sum = top60.reduce((acc, g) => acc + g.p, 0);
        if (sum > 0) {
            top60.forEach(g => {
                g.p = (g.p / sum) * (1 - UNNAMED);
            });
        }
        
        // Filter and round
        top60.filter(g => g.p >= MIN_P).forEach(g => {
            probabilities.push({
                universe_id: g.universe_id,
                place: p + 1,
                p: Math.round(g.p * 1000000) / 1000000
            });
            const idx = gameIdToIndex.get(g.universe_id)!;
            gameTotalProb[idx] += g.p;
            gameExpectedPlaceSum[idx] += g.p * (p + 1);
        });
    }
    
    // Top 10
    const top10Games = games.map((g, i) => ({
        universe_id: g.universe_id,
        prob: gameTotalProb[i],
        expectedPlace: gameTotalProb[i] > 0 ? gameExpectedPlaceSum[i] / gameTotalProb[i] : 100
    }));
    
    top10Games.sort((a, b) => b.prob - a.prob || a.expectedPlace - b.expectedPlace);
    const top10 = top10Games.slice(0, 10).map(g => g.universe_id);
    
    // Write
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, task.output), JSON.stringify({ probabilities, top10 }) + '\n');
}

main();
