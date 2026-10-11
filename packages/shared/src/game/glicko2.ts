// Glicko-2 as in Mark Glickman, "Example of the Glicko-2 system" (2013), steps 1–8 (task 43a).
// A rating period's games update a rating, its deviation and its volatility.

// The system constant τ limits how fast volatility changes; Glickman suggests 0.3–1.2.
export const GLICKO2_TAU = 0.5;
// Converts between the Glicko scale (1500 ± 350) and Glicko-2's internal scale.
const SCALE = 173.7178;
const BASE_RATING = 1500;
// Step 5's iteration stops when the bracket is this narrow.
const CONVERGENCE = 0.000001;

export interface Glicko2Rating {
  rating: number;
  deviation: number;
  volatility: number;
}

export interface Glicko2Game {
  opponent: { rating: number; deviation: number };
  // 1 for a win, 0 for a loss (0.5 for a draw).
  score: number;
}

interface ScaledGame {
  mu: number;
  phi: number;
  score: number;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, game: ScaledGame): number {
  return 1 / (1 + Math.exp(-g(game.phi) * (mu - game.mu)));
}

interface VolatilityInput {
  phi: number;
  sigma: number;
  delta: number;
  v: number;
  tau: number;
}

// newVolatility is step 5: the Illinois algorithm for the new σ.
function newVolatility({ phi, sigma, delta, v, tau }: VolatilityInput): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (tau * tau);
  };
  let low = a;
  let high = delta * delta > phi * phi + v ? Math.log(delta * delta - phi * phi - v) : a - tau;
  if (delta * delta <= phi * phi + v) {
    for (let k = 2; f(high) < 0; k++) {
      high = a - k * tau;
    }
  }
  let fLow = f(low);
  let fHigh = f(high);
  while (Math.abs(high - low) > CONVERGENCE) {
    const next = low + ((low - high) * fLow) / (fHigh - fLow);
    const fNext = f(next);
    if (fNext * fHigh <= 0) {
      low = high;
      fLow = fHigh;
    } else {
      fLow /= 2;
    }
    high = next;
    fHigh = fNext;
  }
  return Math.exp(low / 2);
}

// updateRating rates one player over one rating period. With no games only the deviation grows.
export function updateRating(player: Glicko2Rating, games: Glicko2Game[], tau = GLICKO2_TAU): Glicko2Rating {
  const mu = (player.rating - BASE_RATING) / SCALE;
  const phi = player.deviation / SCALE;
  if (games.length === 0) {
    return { ...player, deviation: Math.sqrt(phi * phi + player.volatility ** 2) * SCALE };
  }
  const scaled = games.map((game) => ({ mu: (game.opponent.rating - BASE_RATING) / SCALE, phi: game.opponent.deviation / SCALE, score: game.score }));
  const v = 1 / scaled.reduce((sum, game) => sum + g(game.phi) ** 2 * expected(mu, game) * (1 - expected(mu, game)), 0);
  const improvement = scaled.reduce((sum, game) => sum + g(game.phi) * (game.score - expected(mu, game)), 0);
  const sigma = newVolatility({ phi, sigma: player.volatility, delta: v * improvement, v, tau });
  const phiStar = Math.sqrt(phi * phi + sigma * sigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  return { rating: (mu + newPhi * newPhi * improvement) * SCALE + BASE_RATING, deviation: newPhi * SCALE, volatility: sigma };
}
