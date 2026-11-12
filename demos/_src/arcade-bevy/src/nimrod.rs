//! Nimrod's game: Nim against the machine, four heaps of up to seven lamps.
//!
//! This is the logic only. It knows nothing of Bevy, so it can be tested on its own:
//!
//! ```text
//! rustc --edition 2024 --test src/nimrod.rs -o /tmp/nimrod_test && /tmp/nimrod_test
//! ```
//!
//! Nimrod was designed by John Bennett and built by Raymond Stuart-Williams at Ferranti, and shown at
//! the Festival of Britain's Exhibition of Science in South Kensington from May 1951, then for three
//! weeks at the Berlin Industrial Show from 6 October 1951, where the economics minister Ludwig Erhard
//! lost all three games he played. What the homage keeps from it:
//!
//! - Four heaps of "matches", each up to seven, shown as rows of lamps. On the visitor's desk each lamp
//!   has a button under it. Pressing a button during your move puts out every lamp to its right, so the
//!   button under the third lamp leaves three. A button at the left of each row, under a white lamp,
//!   empties the row. The white lamps show which heap was changed last.
//! - The big panel on the machine's face repeats the desk's rows for the crowd, with one legend lit at a
//!   time for the stage of the game: the opponent's move, the computer's move, who has won.
//! - The machine had two games: the simple game, where taking the last match wins, and the reverse
//!   game, where it loses. A switch chose who started.
//! - Its move had to be asked for with the COMP. MOVE button. It could be slowed to about a step a
//!   second, so a demonstrator could explain each step as an instruction lamp lit on the left panel and
//!   the registers changed on the right. It could also play both sides by itself.
//! - It played the binary strategy, column by column, and could not be beaten from a losing position.
//!   Visitors "had little chance of winning unless they understood the logic of Nim".
//!
//! How a careful visitor wins here: the machine deals a position and the visitor chooses who starts,
//! by making a move or by pressing COMP. MOVE to hand it the first move. Exactly one of the two is a
//! win for whoever plays perfectly, so a visitor who reads the heaps in binary (the right-hand panel
//! shows each heap's 4, 2 and 1) can win every game. One slip and the machine wins.
//!
//! Score: the matches in each starting position won, doubled in the reverse game, added up over games
//! won in a row. A loss, giving up a game half played, or walking away ends the run.
//!
//! Sources:
//! - https://en.wikipedia.org/wiki/Nimrod_(computer)
//! - https://www.goodeveca.net/nimrod/ (Pete Goodeve's NIMROD pages: the control desk, the game display,
//!   the control panel, hardware facts, the Berlin article, and his simulator's move logic)
//! - Ferranti, "Faster than Thought: The Ferranti Nimrod Digital Computer" (1951 guidebook), via the above
//!
//! Heaps are numbered 0 to 3, top row first as the player sees them.

pub const HEAPS: usize = 4;
/// The most matches a heap can hold, which is the lamps in a row.
pub const MOST: u8 = 7;

/// How a game ended, from the visitor's side.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    Win,
    Lose,
}

/// The lamps of the instruction panel, in order. Only one is lit, while the machine works.
pub const INSTRUCTIONS: usize = 8;
pub const I_READ: u8 = 0;
pub const I_FOURS: u8 = 1;
pub const I_TWOS: u8 = 2;
pub const I_ONES: u8 = 3;
/// The reverse game's test for its end, where it plays differently.
pub const I_END: u8 = 4;
pub const I_SELECT: u8 = 5;
/// The position was safe for the visitor, so the machine just takes one match.
pub const I_TAKE_ONE: u8 = 6;
pub const I_ALTER: u8 = 7;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Phase {
    /// A position is dealt and nobody has moved. The visitor may move, or hand the machine the start.
    Ready,
    PlayerTurn,
    /// The machine is working through its move, one lamp step at a time.
    Thinking { step: usize, left: f32 },
    Over(Outcome),
}

/// The legends on the machine's face.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Legends {
    pub opponents_move: bool,
    pub computers_move: bool,
    pub opponent_wins: bool,
    pub computer_wins: bool,
}

/// Things that happened since the owner last looked, for sounds. See `NimrodGame::events`.
/// A heap button took: lamps went out under the visitor's finger.
pub const EV_PRESS: u32 = 1;
/// A press that could not be taken: out of turn, or a button with no lamp to put out.
pub const EV_REFUSED: u32 = 2;
/// The machine stepped to its next instruction.
pub const EV_STEP: u32 = 4;
/// The machine's move put lamps out.
pub const EV_MOVE: u32 = 8;
pub const EV_WIN: u32 = 16;
pub const EV_LOSE: u32 = 32;
/// A new position was dealt.
pub const EV_DEAL: u32 = 64;
/// The game switch was thrown.
pub const EV_SWITCH: u32 = 128;
/// COMP. MOVE was pressed and taken.
pub const EV_COMP: u32 = 256;

/// The time for each step of the machine's work. The real one could run a step a second for a
/// demonstrator, or all at once. This is quick enough to play and slow enough to watch.
const STEP_TIME: f32 = 0.22;
/// Playing both sides by itself, it rests this long between moves, and longer between games.
const SELF_PAUSE: f32 = 1.4;
const SELF_GAP: f32 = 4.0;
/// Lamps that flash at the end of a game do so this many times a second.
const BLINK_RATE: f32 = 2.0;
/// The run's score is a whole number up to this, as the high score table wants.
const SCORE_CAP: u32 = 5000;

/// A move: which heap, and how many matches it leaves.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Move {
    pub heap: usize,
    pub leave: u8,
}

fn nim_sum(heaps: &[u8; HEAPS]) -> u8 {
    heaps.iter().fold(0, |a, &h| a ^ h)
}

/// The winning move for the side to play, if it has one. In the simple game that leaves the binary
/// columns even. The reverse game plays the same until at most one heap has more than one match;
/// then it leaves an odd number of single matches, so the other side must take the last.
pub fn winning_move(heaps: &[u8; HEAPS], reverse: bool) -> Option<Move> {
    let big: Vec<usize> = (0..HEAPS).filter(|&h| heaps[h] > 1).collect();
    if reverse && big.len() <= 1 {
        let ones = (0..HEAPS).filter(|&h| heaps[h] == 1).count();
        return match big.first() {
            // Leave the big heap at one or none, whichever makes the single matches odd.
            Some(&heap) => Some(Move { heap, leave: if ones % 2 == 1 { 0 } else { 1 } }),
            // Only single matches: taking one wins if it leaves an odd number.
            None if ones % 2 == 0 && ones > 0 => {
                Some(Move { heap: (0..HEAPS).find(|&h| heaps[h] == 1)?, leave: 0 })
            }
            None => None,
        };
    }
    let sum = nim_sum(heaps);
    if sum == 0 {
        return None;
    }
    // The first heap, top down, with the highest odd column set: Nimrod's own choice.
    let top = 1 << (7 - sum.leading_zeros());
    let heap = (0..HEAPS).find(|&h| heaps[h] & top != 0)?;
    Some(Move { heap, leave: heaps[heap] ^ sum })
}

/// The machine's move: the winning one, or, from a losing position, one match off the first heap that
/// has any, as Nimrod did.
pub fn machine_move(heaps: &[u8; HEAPS], reverse: bool) -> Option<Move> {
    winning_move(heaps, reverse).or_else(|| {
        let heap = (0..HEAPS).find(|&h| heaps[h] > 0)?;
        Some(Move { heap, leave: heaps[heap] - 1 })
    })
}

/// One step of the machine's work, as the lamps show it.
#[derive(Clone, Copy, PartialEq, Debug)]
struct Step {
    instruction: u8,
    /// The parity lamps lit after this step: bit 2 is the fours column, bit 0 the ones.
    parity: u8,
    selected: Option<usize>,
}

/// The steps the machine shows for a move from `heaps`, in order, ending with the move.
fn plan(heaps: &[u8; HEAPS], reverse: bool, chosen: Move) -> Vec<Step> {
    let mut steps = vec![Step { instruction: I_READ, parity: 0, selected: None }];
    let ending = reverse && (0..HEAPS).filter(|&h| heaps[h] > 1).count() <= 1;
    let mut parity = 0;
    if reverse {
        steps.push(Step { instruction: I_END, parity, selected: None });
    }
    if !ending {
        let sum = nim_sum(heaps);
        for (instruction, bit) in [(I_FOURS, 4), (I_TWOS, 2), (I_ONES, 1)] {
            parity |= sum & bit;
            steps.push(Step { instruction, parity, selected: None });
        }
    }
    let safe = winning_move(heaps, reverse).is_none();
    if safe {
        steps.push(Step { instruction: I_TAKE_ONE, parity, selected: Some(chosen.heap) });
    } else {
        steps.push(Step { instruction: I_SELECT, parity, selected: Some(chosen.heap) });
    }
    steps.push(Step { instruction: I_ALTER, parity, selected: Some(chosen.heap) });
    steps
}

#[derive(Clone)]
struct Rng(u32);
impl Rng {
    fn next(&mut self) -> u32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        self.0
    }
    fn below(&mut self, n: u32) -> u32 {
        (self.next() >> 8) % n.max(1)
    }
}

#[derive(Clone)]
pub struct NimrodGame {
    /// What has happened since the owner last looked, as `EV_` bits. The owner clears it.
    pub events: u32,
    /// Games since the machine was switched on, by how they ended for the visitor.
    pub wins: u32,
    pub losses: u32,
    heaps: [u8; HEAPS],
    /// What the position held when it was dealt, for the score.
    dealt: u8,
    reverse: bool,
    phase: Phase,
    /// The machine's work in progress, and the move it ends with.
    steps: Vec<Step>,
    chosen: Option<Move>,
    /// What the registers' parity and select lamps show. They hold after a move until the next.
    parity: u8,
    selected: Option<usize>,
    /// The heap changed by the last move, either side's.
    last_changed: Option<usize>,
    /// Playing both sides by itself, as it did for the crowd. The heap buttons do nothing then.
    play_self: bool,
    /// Counts down the rest between moves when playing by itself.
    rest: f32,
    /// Runs while a game is over, to flash the winner's legend.
    clock: f32,
    streak: u32,
    /// Games won in the run in progress. Deals grow with it.
    run_games: u32,
    ended: Option<u32>,
    rng: Rng,
}

impl NimrodGame {
    /// A machine with a position dealt, ready for a visitor. The simple game.
    pub fn new(seed: u32) -> Self {
        let mut game = Self {
            events: 0,
            wins: 0,
            losses: 0,
            heaps: [0; HEAPS],
            dealt: 0,
            reverse: false,
            phase: Phase::Ready,
            steps: Vec::new(),
            chosen: None,
            parity: 0,
            selected: None,
            last_changed: None,
            play_self: false,
            rest: 0.0,
            clock: 0.0,
            streak: 0,
            run_games: 0,
            ended: None,
            rng: Rng(seed | 1),
        };
        game.deal();
        game.events = 0;
        game
    }

    /// Sets the heaps by hand and makes the position ready. For the tests, and for a demonstrator.
    pub fn set_up(&mut self, heaps: [u8; HEAPS]) {
        self.heaps = heaps.map(|h| h.min(MOST));
        self.dealt = self.heaps.iter().sum();
        self.phase = Phase::Ready;
        self.steps.clear();
        self.chosen = None;
        self.parity = 0;
        self.selected = None;
        self.last_changed = None;
        self.clock = 0.0;
    }

    /// Deals a fresh position, ready for either side to start. Deals grow as a run of wins goes on:
    /// up to three in a heap at first, up to seven after four wins. A game given up half played ends
    /// the run, as a loss would.
    pub fn deal(&mut self) {
        if matches!(self.phase, Phase::PlayerTurn | Phase::Thinking { .. }) && !self.play_self {
            self.end_streak();
        }
        let most = (3 + self.run_games).min(MOST as u32);
        let heaps = [(); HEAPS].map(|_| 1 + self.rng.below(most) as u8);
        self.set_up(heaps);
        self.events |= EV_DEAL;
    }

    /// Lets the machine play both sides by itself, or stops it. Stopping deals a fresh position.
    pub fn set_play_self(&mut self, on: bool) {
        if on == self.play_self {
            return;
        }
        if on {
            self.end_streak();
        }
        self.play_self = on;
        self.rest = SELF_PAUSE;
        self.deal();
    }

    pub fn play_self(&self) -> bool {
        self.play_self
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn heap(&self, heap: usize) -> u8 {
        self.heaps.get(heap).copied().unwrap_or(0)
    }

    pub fn heaps(&self) -> [u8; HEAPS] {
        self.heaps
    }

    pub fn reverse(&self) -> bool {
        self.reverse
    }

    pub fn over(&self) -> Option<Outcome> {
        match self.phase {
            Phase::Over(outcome) => Some(outcome),
            _ => None,
        }
    }

    /// The score of the run of wins in progress.
    #[allow(dead_code)] // read by the tests
    pub fn streak(&self) -> u32 {
        self.streak
    }

    /// Ends the run of wins, as a loss or walking away does. Its score waits in `take_ended`.
    pub fn end_streak(&mut self) {
        if self.streak > 0 {
            self.ended = Some(self.streak.min(SCORE_CAP));
        }
        self.streak = 0;
        self.run_games = 0;
    }

    /// The score of a run that has ended, once.
    pub fn take_ended(&mut self) -> Option<u32> {
        self.ended.take()
    }

    /// Throws the game switch. It only moves before the first move or after the end, as a demonstrator
    /// would not change the rules mid-game. Returns true if it moved.
    pub fn set_reverse(&mut self, reverse: bool) -> bool {
        if reverse == self.reverse {
            return true;
        }
        if matches!(self.phase, Phase::PlayerTurn | Phase::Thinking { .. }) {
            self.events |= EV_REFUSED;
            return false;
        }
        self.reverse = reverse;
        self.events |= EV_SWITCH;
        true
    }

    /// The visitor presses a heap button: the button under lamp `leave` in row `heap`, or the zero
    /// button for 0. It must put out at least one lamp. Returns true if it took.
    pub fn press(&mut self, heap: usize, leave: u8) -> bool {
        let open = matches!(self.phase, Phase::Ready | Phase::PlayerTurn) && !self.play_self;
        if !open || heap >= HEAPS || leave >= self.heaps[heap] {
            self.events |= EV_REFUSED;
            return false;
        }
        self.heaps[heap] = leave;
        self.last_changed = Some(heap);
        // The registers forget the machine's last working once the visitor has answered it.
        self.parity = 0;
        self.selected = None;
        self.events |= EV_PRESS;
        if !self.finish(false) {
            self.think();
        }
        true
    }

    /// COMP. MOVE: asks the machine to move. Only taken before the first move, which hands it the
    /// start; afterwards it answers each move by itself. Returns true if it took.
    pub fn computer_move(&mut self) -> bool {
        if self.phase != Phase::Ready || self.play_self {
            self.events |= EV_REFUSED;
            return false;
        }
        self.events |= EV_COMP;
        self.think();
        true
    }

    fn think(&mut self) {
        let chosen = machine_move(&self.heaps, self.reverse);
        self.steps = chosen.map(|m| plan(&self.heaps, self.reverse, m)).unwrap_or_default();
        self.chosen = chosen;
        self.parity = 0;
        self.selected = None;
        self.phase = Phase::Thinking { step: 0, left: STEP_TIME };
        self.events |= EV_STEP;
    }

    /// Advances time by `dt` seconds.
    pub fn step(&mut self, dt: f32) {
        match self.phase {
            Phase::Thinking { step, left } => {
                if left > dt {
                    self.phase = Phase::Thinking { step, left: left - dt };
                    return;
                }
                if let Some(s) = self.steps.get(step) {
                    self.parity = s.parity;
                    self.selected = s.selected;
                }
                if step + 1 < self.steps.len() {
                    self.phase = Phase::Thinking { step: step + 1, left: STEP_TIME };
                    self.events |= EV_STEP;
                    return;
                }
                let Some(m) = self.chosen.take() else { return };
                self.heaps[m.heap] = m.leave;
                self.last_changed = Some(m.heap);
                self.events |= EV_MOVE;
                if !self.finish(true) {
                    self.phase = Phase::PlayerTurn;
                    self.rest = SELF_PAUSE;
                }
            }
            Phase::Over(_) => {
                self.clock += dt;
                if self.play_self && self.clock > SELF_GAP {
                    self.deal();
                    self.rest = SELF_PAUSE;
                }
            }
            Phase::Ready | Phase::PlayerTurn => {
                if self.play_self {
                    self.rest -= dt;
                    if self.rest <= 0.0 {
                        self.think();
                    }
                }
            }
        }
    }

    /// Ends the game if the last match has gone. Returns true if it did.
    fn finish(&mut self, machine_moved: bool) -> bool {
        if self.heaps.iter().any(|&h| h > 0) {
            return false;
        }
        // In the simple game whoever took the last match wins; in the reverse game they lose.
        let machine_won = machine_moved != self.reverse;
        let outcome = if machine_won { Outcome::Lose } else { Outcome::Win };
        self.clock = 0.0;
        self.phase = Phase::Over(outcome);
        if self.play_self {
            return true;
        }
        if outcome == Outcome::Win {
            self.wins += 1;
            self.events |= EV_WIN;
            // A win is worth the matches it started with, twice over in the reverse game.
            self.streak += self.dealt as u32 * if self.reverse { 2 } else { 1 };
            self.run_games += 1;
        } else {
            self.losses += 1;
            self.events |= EV_LOSE;
            self.end_streak();
        }
        true
    }

    /// Whether lamp `n` (1 to 7) of a row is lit: that match is still in the heap.
    pub fn lamp(&self, heap: usize, n: u8) -> bool {
        n >= 1 && n <= self.heap(heap)
    }

    /// The white lamp at the left of a row: the heap changed last. It flashes when the game is over.
    pub fn changed_lamp(&self, heap: usize) -> bool {
        let on = self.last_changed == Some(heap);
        if self.over().is_some() { on && self.blink() } else { on }
    }

    /// The register lamps of a heap, 4, 2 and 1, as bits of its count.
    pub fn register(&self, heap: usize) -> u8 {
        self.heap(heap)
    }

    /// The parity lamps, one for each binary column that the machine found odd. Bit 2 is the fours.
    pub fn parity(&self) -> u8 {
        self.parity
    }

    /// The register's select lamp: the heap the machine chose.
    pub fn selected(&self) -> Option<usize> {
        self.selected
    }

    /// The instruction lamp lit while the machine works.
    pub fn instruction(&self) -> Option<u8> {
        match self.phase {
            Phase::Thinking { step, .. } => self.steps.get(step).map(|s| s.instruction),
            _ => None,
        }
    }

    fn blink(&self) -> bool {
        (self.clock * BLINK_RATE).fract() < 0.6
    }

    pub fn legends(&self) -> Legends {
        Legends {
            opponents_move: matches!(self.phase, Phase::Ready | Phase::PlayerTurn),
            computers_move: matches!(self.phase, Phase::Thinking { .. }),
            opponent_wins: self.phase == Phase::Over(Outcome::Win),
            computer_wins: self.phase == Phase::Over(Outcome::Lose),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index(heaps: [u8; HEAPS]) -> usize {
        heaps.iter().enumerate().map(|(i, &h)| (h as usize) << (3 * i)).sum()
    }

    /// Whether the side to move wins with best play, for every position, worked out by search. A move
    /// lowers one heap, which always lowers the index, so each entry needs only those before it.
    fn win_table(reverse: bool) -> Vec<bool> {
        let mut table = vec![false; 1 << (3 * HEAPS)];
        for heaps in every_position() {
            table[index(heaps)] = if heaps.iter().all(|&h| h == 0) {
                // The other side took the last match.
                reverse
            } else {
                (0..HEAPS).any(|h| (0..heaps[h]).any(|leave| {
                    let mut next = heaps;
                    next[h] = leave;
                    !table[index(next)]
                }))
            };
        }
        table
    }

    fn wins(heaps: [u8; HEAPS], reverse: bool) -> bool {
        win_table(reverse)[index(heaps)]
    }

    fn every_position() -> impl Iterator<Item = [u8; HEAPS]> {
        (0..8u32.pow(HEAPS as u32)).map(|n| [0, 1, 2, 3].map(|i| ((n >> (3 * i)) & 7) as u8))
    }

    #[test]
    fn the_strategy_finds_a_win_exactly_when_there_is_one() {
        for reverse in [false, true] {
            let table = win_table(reverse);
            // The empty position has no move to find: the game is already over.
            for heaps in every_position().skip(1) {
                let winning = table[index(heaps)];
                let found = winning_move(&heaps, reverse);
                assert_eq!(found.is_some(), winning, "{heaps:?} reverse {reverse}");
                if let Some(m) = found {
                    assert!(m.leave < heaps[m.heap], "{heaps:?} {m:?}");
                    let mut next = heaps;
                    next[m.heap] = m.leave;
                    assert!(!table[index(next)], "{heaps:?} {m:?} reverse {reverse}");
                }
            }
        }
    }

    /// Runs the machine's work through to its move.
    fn settle(game: &mut NimrodGame) {
        while matches!(game.phase(), Phase::Thinking { .. }) {
            game.step(0.05);
        }
    }

    /// Whether any line of visitor play beats the real machine from here, its timing included. The
    /// machine's answer depends only on the heaps, so positions already tried are remembered.
    fn visitor_can_win(game: &NimrodGame, seen: &mut std::collections::HashMap<usize, bool>) -> bool {
        match game.over() {
            Some(Outcome::Win) => return true,
            Some(Outcome::Lose) => return false,
            None => {}
        }
        if let Some(&known) = seen.get(&index(game.heaps())) {
            return known;
        }
        let result = (0..HEAPS).any(|h| (0..game.heap(h)).any(|leave| {
            let mut next = game.clone();
            assert!(next.press(h, leave));
            settle(&mut next);
            visitor_can_win(&next, seen)
        }));
        seen.insert(index(game.heaps()), result);
        result
    }

    #[test]
    fn the_machine_never_loses_from_a_winning_position() {
        for reverse in [false, true] {
            for heaps in [[1, 3, 5, 7], [2, 3, 4, 5], [1, 2, 4, 6], [3, 3, 2, 1], [1, 1, 1, 2], [7, 6, 0, 2]] {
                let mut game = NimrodGame::new(1);
                game.set_reverse(reverse);
                game.set_up(heaps);
                if wins(heaps, reverse) {
                    // Handed the start in a winning position, it never loses.
                    assert!(game.computer_move());
                    settle(&mut game);
                    assert!(!visitor_can_win(&game, &mut Default::default()), "{heaps:?} reverse {reverse}");
                } else {
                    // Every move the visitor can make hands it a winning position.
                    assert!(!visitor_can_win(&game, &mut Default::default()), "{heaps:?} reverse {reverse}");
                }
            }
        }
    }

    /// The visitor who reads the position: starts if it is a win, else hands over the start, and
    /// always plays the winning move.
    fn careful_visitor(game: &mut NimrodGame) {
        match winning_move(&game.heaps(), game.reverse()) {
            Some(m) => assert!(game.press(m.heap, m.leave)),
            None => assert!(game.computer_move()),
        }
        loop {
            settle(game);
            if game.over().is_some() {
                return;
            }
            let m = winning_move(&game.heaps(), game.reverse()).expect("the careful visitor keeps a winning position");
            assert!(game.press(m.heap, m.leave));
        }
    }

    #[test]
    fn a_careful_visitor_wins_every_game_by_choosing_who_starts() {
        let mut game = NimrodGame::new(0x1951);
        for i in 0..300 {
            game.set_reverse(i % 3 == 0);
            careful_visitor(&mut game);
            assert_eq!(game.over(), Some(Outcome::Win));
            game.deal();
        }
        assert_eq!((game.wins, game.losses), (300, 0));
    }

    #[test]
    fn a_careless_visitor_loses_most_games() {
        let mut game = NimrodGame::new(7);
        for _ in 0..300 {
            // Always takes one match from the first heap that has any, and always starts.
            while game.over().is_none() {
                let h = (0..HEAPS).find(|&h| game.heap(h) > 0).unwrap();
                assert!(game.press(h, game.heap(h) - 1));
                settle(&mut game);
            }
            game.deal();
        }
        assert!(game.losses > 200, "{} wins, {} losses", game.wins, game.losses);
    }

    #[test]
    fn simple_and_reverse_decide_the_last_match_differently() {
        let mut game = NimrodGame::new(1);
        game.set_up([0, 0, 1, 0]);
        game.events = 0;
        assert!(game.press(2, 0));
        assert_eq!(game.over(), Some(Outcome::Win));
        assert_eq!(game.events, EV_PRESS | EV_WIN);
        assert_eq!(game.legends(), Legends { opponent_wins: true, ..Legends::default() });

        let mut game = NimrodGame::new(1);
        assert!(game.set_reverse(true));
        game.set_up([0, 0, 1, 0]);
        assert!(game.press(2, 0));
        assert_eq!(game.over(), Some(Outcome::Lose));
        assert!(game.legends().computer_wins);
    }

    #[test]
    fn the_machine_shows_its_working_step_by_step() {
        let mut game = NimrodGame::new(1);
        game.set_up([1, 3, 5, 0]);
        // 1 ^ 3 ^ 5 = 7: every column odd. The machine takes from the first heap with a four.
        assert!(game.computer_move());
        let mut seen = Vec::new();
        while matches!(game.phase(), Phase::Thinking { .. }) {
            if let Some(i) = game.instruction() {
                if seen.last() != Some(&i) {
                    seen.push(i);
                }
            }
            assert!(game.legends().computers_move);
            game.step(0.05);
        }
        assert_eq!(seen, vec![I_READ, I_FOURS, I_TWOS, I_ONES, I_SELECT, I_ALTER]);
        assert_eq!(game.heaps(), [1, 3, 2, 0]);
        assert_eq!(game.parity(), 7);
        assert_eq!(game.selected(), Some(2));
        assert!(game.changed_lamp(2) && !game.changed_lamp(0));
        assert_eq!(game.phase(), Phase::PlayerTurn);
        assert!(game.legends().opponents_move);
        // The visitor's answer clears the registers' working.
        assert!(game.press(0, 0));
        assert_eq!(game.parity(), 0);
        assert_eq!(game.selected(), None);
    }

    #[test]
    fn from_a_safe_position_it_takes_one_match() {
        let mut game = NimrodGame::new(1);
        game.set_up([1, 2, 3, 0]);
        assert!(game.computer_move());
        let mut saw_take_one = false;
        while matches!(game.phase(), Phase::Thinking { .. }) {
            saw_take_one |= game.instruction() == Some(I_TAKE_ONE);
            game.step(0.05);
        }
        assert!(saw_take_one);
        assert_eq!(game.heaps(), [0, 2, 3, 0]);
        assert_eq!(game.parity(), 0);
    }

    #[test]
    fn the_reverse_game_tests_for_its_end() {
        let mut game = NimrodGame::new(1);
        game.set_reverse(true);
        game.set_up([1, 1, 4, 0]);
        assert!(game.computer_move());
        let mut seen = Vec::new();
        while matches!(game.phase(), Phase::Thinking { .. }) {
            if let Some(i) = game.instruction() {
                if seen.last() != Some(&i) {
                    seen.push(i);
                }
            }
            game.step(0.05);
        }
        assert_eq!(seen, vec![I_READ, I_END, I_SELECT, I_ALTER]);
        // Two single matches left with the big heap gone would be even; it leaves one in it instead.
        assert_eq!(game.heaps(), [1, 1, 1, 0]);
    }

    #[test]
    fn buttons_put_out_lamps_to_their_right_and_no_more() {
        let mut game = NimrodGame::new(1);
        game.set_up([5, 2, 7, 1]);
        game.events = 0;
        // The button under the fifth lamp of a heap of five puts nothing out.
        assert!(!game.press(0, 5));
        assert!(!game.press(0, 6));
        assert!(!game.press(4, 0));
        assert_eq!(game.events, EV_REFUSED);
        assert_eq!(game.phase(), Phase::Ready);
        assert!(game.press(2, 3));
        assert!((1..=3).all(|n| game.lamp(2, n)) && !game.lamp(2, 4));
        assert!(!game.lamp(2, 0));
        // The machine is working: nothing may be pressed, and the switch will not move.
        game.events = 0;
        assert!(!game.press(0, 0));
        assert!(!game.computer_move());
        assert!(!game.set_reverse(true));
        assert_eq!(game.events, EV_REFUSED);
        settle(&mut game);
        // COMP. MOVE only hands over the start; afterwards the machine answers by itself.
        assert!(!game.computer_move());
    }

    #[test]
    fn a_run_adds_each_start_and_doubles_the_reverse_game() {
        let mut game = NimrodGame::new(1);
        let win = |game: &mut NimrodGame, reverse: bool, heaps: [u8; HEAPS]| {
            game.set_reverse(reverse);
            game.set_up(heaps);
            careful_visitor(game);
            assert_eq!(game.over(), Some(Outcome::Win));
        };
        win(&mut game, false, [1, 2, 3, 4]);
        win(&mut game, true, [2, 2, 1, 1]);
        assert_eq!(game.streak(), 10 + 2 * 6);
        assert_eq!(game.take_ended(), None);
        // A loss ends the run and hands its score over once.
        game.set_reverse(false);
        game.set_up([0, 0, 0, 2]);
        assert!(game.press(3, 1));
        settle(&mut game);
        assert_eq!(game.over(), Some(Outcome::Lose));
        assert_eq!(game.take_ended(), Some(22));
        assert_eq!(game.take_ended(), None);
        // Dealing again half way through a game gives it up, and ends the run.
        win(&mut game, false, [1, 0, 0, 0]);
        game.set_up([3, 3, 3, 3]);
        assert!(game.press(0, 1));
        settle(&mut game);
        game.deal();
        assert_eq!(game.take_ended(), Some(1));
        // A fresh deal before anyone has moved costs nothing.
        win(&mut game, false, [1, 0, 0, 0]);
        game.deal();
        game.deal();
        assert_eq!(game.take_ended(), None);
        game.end_streak();
        assert_eq!(game.take_ended(), Some(1));
    }

    #[test]
    fn deals_grow_with_the_run() {
        let mut game = NimrodGame::new(99);
        for _ in 0..50 {
            game.deal();
            assert!(game.heaps().iter().all(|&h| (1..=3).contains(&h)), "{:?}", game.heaps());
        }
        game.run_games = 9;
        let mut seen_seven = false;
        for _ in 0..200 {
            game.deal();
            seen_seven |= game.heaps().contains(&7);
            assert!(game.heaps().iter().all(|&h| (1..=MOST).contains(&h)));
        }
        assert!(seen_seven);
    }

    #[test]
    fn the_switch_moves_only_between_games() {
        let mut game = NimrodGame::new(1);
        game.events = 0;
        assert!(game.set_reverse(true));
        assert_eq!(game.events, EV_SWITCH);
        assert!(game.reverse());
        game.set_up([0, 0, 0, 1]);
        assert!(game.press(3, 0));
        // Over: the switch may move again, for the next game.
        assert!(game.set_reverse(false));
    }

    #[test]
    fn it_plays_itself_for_the_crowd_and_scores_nothing() {
        let mut game = NimrodGame::new(5);
        game.set_play_self(true);
        assert!(!game.press(0, 0));
        let mut games = 0;
        let mut was_over = false;
        for _ in 0..20_000 {
            game.step(0.05);
            let over = game.over().is_some();
            games += (over && !was_over) as u32;
            was_over = over;
        }
        assert!(games >= 5, "only {games} games");
        assert_eq!((game.wins, game.losses, game.streak()), (0, 0, 0));
        assert_eq!(game.take_ended(), None);
        // Stepping up stops it and deals a fresh position.
        game.set_play_self(false);
        assert_eq!(game.phase(), Phase::Ready);
        assert!(game.heaps().iter().all(|&h| h > 0));
    }

    #[test]
    fn the_winner_flashes_its_last_row() {
        let mut game = NimrodGame::new(1);
        game.set_up([0, 1, 0, 0]);
        assert!(game.press(1, 0));
        let mut seen = [false; 2];
        for _ in 0..40 {
            game.step(0.05);
            seen[game.changed_lamp(1) as usize] = true;
            assert!(!game.changed_lamp(0));
        }
        assert_eq!(seen, [true, true]);
    }

    #[test]
    fn a_run_is_capped_for_the_table() {
        let mut game = NimrodGame::new(1);
        game.streak = 9000;
        game.end_streak();
        assert_eq!(game.take_ended(), Some(5000));
    }
}
