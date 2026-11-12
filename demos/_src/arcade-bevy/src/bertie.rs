//! Bertie the Brain's game: noughts and crosses against the machine.
//!
//! This is the logic only. It knows nothing of Bevy, so it can be tested on its own:
//!
//! ```text
//! rustc --edition 2024 --test src/bertie.rs -o /tmp/bertie_test && /tmp/bertie_test
//! ```
//!
//! The real Bertie was built by Josef Kates for Rogers Majestic and shown at the Canadian National
//! Exhibition in Toronto from 25 August to 9 September 1950. What the homage keeps from it:
//!
//! - The player presses one of nine lit keys in a three by three grid on a raised panel.
//! - The machine answers on a large upright board of nine squares, each with an X lamp and an O lamp.
//! - The machine is X and the visitor is O. Two signs beside the board, "Electronic Brain" with an X
//!   and "Human Brain" with an O, take turns to light and show whose move it is. Each has a "Win" lamp.
//! - The difficulty could be set to several levels. Kates turned it down for children and up for
//!   adults. At the top level it could not be beaten.
//! - It answered almost at once. The short pause here is only so the lamps can be read.
//!
//! Sources:
//! - https://en.wikipedia.org/wiki/Bertie_the_Brain
//! - https://spacing.ca/toronto/?p=49118 (Spacing Toronto on Bertie at the fair)
//! - https://en.wikipedia.org/wiki/Additron_tube
//!
//! Cells are numbered 0 to 8, row by row, with 0 at the top left as the player sees the board.

/// What one square of the board shows.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Mark {
    Empty,
    /// The machine.
    X,
    /// The player.
    O,
}

/// How a game ended, from the player's side.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    Win,
    Lose,
    Draw,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Phase {
    PlayerTurn,
    /// The machine is about to move. The number is the seconds left.
    Thinking(f32),
    Over(Outcome),
}

/// The five sign lamps beside the board.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Signs {
    /// "Human Brain": the player is to move.
    pub player: bool,
    /// "Electronic Brain": the machine is to move.
    pub machine: bool,
    /// The player won.
    pub win: bool,
    /// The machine won.
    pub lose: bool,
    pub draw: bool,
}

/// Things that happened since the machine's owner last looked, for sounds. See `BertieGame::events`.
/// The player's O lamp came on.
pub const EV_KEY: u32 = 1;
/// The machine's X lamp came on.
pub const EV_LAMP: u32 = 2;
pub const EV_WIN: u32 = 4;
pub const EV_LOSE: u32 = 8;
pub const EV_DRAW: u32 = 16;
pub const EV_RESET: u32 = 32;
/// A key was pressed that could not be taken.
pub const EV_REFUSED: u32 = 64;
/// The difficulty dial moved a notch.
pub const EV_DIAL: u32 = 128;

/// The dial has this many notches. Level 0 is the gentlest; the last cannot be beaten.
pub const LEVELS: u8 = 5;
pub const PERFECT: u8 = LEVELS - 1;

/// How often, at each level, the machine plays any free square instead of its best one.
const BLUNDER: [f32; LEVELS as usize] = [0.85, 0.55, 0.30, 0.12, 0.0];

/// The pause before the machine's lamp comes on. The real one answered at once; a beat reads better.
const THINK_TIME: f32 = 0.7;
/// The winning three flash this many times a second.
const BLINK_RATE: f32 = 2.5;

const ALL: u16 = 0x1FF;
/// The eight lines of three, as bit masks. Bit `i` is cell `i`.
const LINES: [u16; 8] = [0o007, 0o070, 0o700, 0o111, 0o222, 0o444, 0o421, 0o124];

fn line_of(cells: u16) -> Option<u16> {
    LINES.iter().copied().find(|&l| cells & l == l)
}

/// The worth of a position to the side about to move: above zero is a forced win, below is a forced
/// loss. Quick wins and slow losses score better, so the machine does not dawdle or give up.
fn worth(me: u16, them: u16) -> i32 {
    let free = ALL & !(me | them);
    if line_of(them).is_some() {
        return -(1 + free.count_ones() as i32);
    }
    let mut best = if free == 0 { 0 } else { i32::MIN };
    for cell in 0..9 {
        if free & (1 << cell) != 0 {
            best = best.max(-worth(them, me | 1 << cell));
        }
    }
    best
}

/// Every best move for the side about to move, as a bit mask of cells.
pub fn best_moves(me: u16, them: u16) -> u16 {
    let free = ALL & !(me | them);
    // On an empty board every square draws with good play. Saying so saves the longest search.
    if free == ALL {
        return ALL;
    }
    let (mut best, mut cells) = (i32::MIN, 0);
    for cell in 0..9 {
        if free & (1 << cell) == 0 {
            continue;
        }
        let w = -worth(them, me | 1 << cell);
        if w > best {
            (best, cells) = (w, 0);
        }
        if w == best {
            cells |= 1 << cell;
        }
    }
    cells
}

#[derive(Clone)]
struct Rng(u32);
impl Rng {
    fn next(&mut self) -> f32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        (self.0 >> 8) as f32 / (1u32 << 24) as f32
    }
    /// One of the set bits of `cells`, each as likely as the others.
    fn pick(&mut self, cells: u16) -> usize {
        let n = cells.count_ones();
        let mut skip = ((self.next() * n as f32) as u32).min(n.saturating_sub(1));
        for cell in 0..9 {
            if cells & (1 << cell) != 0 {
                if skip == 0 {
                    return cell;
                }
                skip -= 1;
            }
        }
        0
    }
}

#[derive(Clone)]
pub struct BertieGame {
    /// What has happened since the owner last looked, as `EV_` bits. The owner clears it.
    pub events: u32,
    /// Games since the machine was switched on, by how they ended for the player.
    pub wins: u32,
    pub losses: u32,
    pub draws: u32,
    x: u16,
    o: u16,
    phase: Phase,
    level: u8,
    /// Who opens the game in play. The opener changes every game, as it did for the fair's visitors.
    player_opens: bool,
    /// Runs while a game is over, to flash the winning three.
    clock: f32,
    rng: Rng,
}

impl BertieGame {
    /// A machine ready for its first game. The player opens it.
    pub fn new(seed: u32) -> Self {
        Self {
            events: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            x: 0,
            o: 0,
            phase: Phase::PlayerTurn,
            level: 2,
            player_opens: true,
            clock: 0.0,
            rng: Rng(seed | 1),
        }
    }

    /// Clears the board for a new game. The other side opens this time.
    pub fn reset(&mut self) {
        let opens = !self.player_opens;
        self.start(opens);
    }

    /// Clears the board and says who opens.
    pub fn start(&mut self, player_opens: bool) {
        self.x = 0;
        self.o = 0;
        self.clock = 0.0;
        self.player_opens = player_opens;
        self.phase = if player_opens { Phase::PlayerTurn } else { Phase::Thinking(THINK_TIME) };
        self.events |= EV_RESET;
    }

    #[allow(dead_code)] // the tests read it, and a display of the machine thinking will
    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn over(&self) -> Option<Outcome> {
        match self.phase {
            Phase::Over(outcome) => Some(outcome),
            _ => None,
        }
    }

    pub fn level(&self) -> u8 {
        self.level
    }

    /// Turns the dial. It may be turned at any time; the machine's next move uses the new level.
    pub fn set_level(&mut self, level: u8) {
        let level = level.min(PERFECT);
        if level != self.level {
            self.level = level;
            self.events |= EV_DIAL;
        }
    }

    /// Turns the dial by whole notches, stopping at either end.
    pub fn turn_dial(&mut self, notches: i32) {
        self.set_level((self.level as i32 + notches).clamp(0, PERFECT as i32) as u8);
    }

    /// The player presses a key. Returns true if the square was taken. A press out of turn, on a
    /// taken square, or after the game is over changes nothing.
    pub fn press(&mut self, cell: usize) -> bool {
        if self.phase != Phase::PlayerTurn || cell >= 9 || (self.x | self.o) & (1 << cell) != 0 {
            self.events |= EV_REFUSED;
            return false;
        }
        self.o |= 1 << cell;
        self.events |= EV_KEY;
        if !self.finish() {
            self.phase = Phase::Thinking(THINK_TIME);
        }
        true
    }

    /// Advances time by `dt` seconds. The machine moves when it has finished thinking.
    pub fn step(&mut self, dt: f32) {
        match self.phase {
            Phase::Thinking(left) if left > dt => self.phase = Phase::Thinking(left - dt),
            Phase::Thinking(_) => {
                let cell = self.choose();
                self.x |= 1 << cell;
                self.events |= EV_LAMP;
                if !self.finish() {
                    self.phase = Phase::PlayerTurn;
                }
            }
            Phase::Over(_) => self.clock += dt,
            Phase::PlayerTurn => {}
        }
    }

    /// What is in a square.
    pub fn mark(&self, cell: usize) -> Mark {
        if cell < 9 && self.x & (1 << cell) != 0 {
            Mark::X
        } else if cell < 9 && self.o & (1 << cell) != 0 {
            Mark::O
        } else {
            Mark::Empty
        }
    }

    /// Which lamp of a square is lit right now. It is `mark`, except that the winning three flash.
    pub fn lamp(&self, cell: usize) -> Mark {
        let flashing = self.winning_line().is_some_and(|line| line.contains(&cell));
        if flashing && (self.clock * BLINK_RATE).fract() >= 0.5 { Mark::Empty } else { self.mark(cell) }
    }

    /// True while the key under a free square is lit to invite a press.
    #[allow(dead_code)] // for keys that light when their square is free
    pub fn key_lit(&self, cell: usize) -> bool {
        self.phase == Phase::PlayerTurn && self.mark(cell) == Mark::Empty
    }

    pub fn signs(&self) -> Signs {
        Signs {
            player: self.phase == Phase::PlayerTurn,
            machine: matches!(self.phase, Phase::Thinking(_)),
            win: self.phase == Phase::Over(Outcome::Win),
            lose: self.phase == Phase::Over(Outcome::Lose),
            draw: self.phase == Phase::Over(Outcome::Draw),
        }
    }

    /// The three cells that won the game, if it was won.
    pub fn winning_line(&self) -> Option<[usize; 3]> {
        let line = line_of(self.x).or_else(|| line_of(self.o))?;
        let mut cells = (0..9).filter(|c| line & (1 << c) != 0);
        Some([cells.next()?, cells.next()?, cells.next()?])
    }

    /// Ends the game if the last move won it or filled the board. Returns true if it did.
    fn finish(&mut self) -> bool {
        let outcome = if line_of(self.o).is_some() {
            Outcome::Win
        } else if line_of(self.x).is_some() {
            Outcome::Lose
        } else if self.x | self.o == ALL {
            Outcome::Draw
        } else {
            return false;
        };
        match outcome {
            Outcome::Win => (self.wins += 1, self.events |= EV_WIN),
            Outcome::Lose => (self.losses += 1, self.events |= EV_LOSE),
            Outcome::Draw => (self.draws += 1, self.events |= EV_DRAW),
        };
        self.clock = 0.0;
        self.phase = Phase::Over(outcome);
        true
    }

    /// The machine's move. Below the top level it sometimes plays any free square, and that is the
    /// whole of the difficulty: the lower the dial, the more often it slips.
    fn choose(&mut self) -> usize {
        let free = ALL & !(self.x | self.o);
        let slip = self.rng.next() < BLUNDER[self.level as usize];
        let from = if slip { free } else { best_moves(self.x, self.o) };
        self.rng.pick(from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Plays the machine's thinking through to its move.
    fn settle(game: &mut BertieGame) {
        while matches!(game.phase(), Phase::Thinking(_)) {
            game.step(0.1);
        }
    }

    fn board(game: &BertieGame) -> Vec<Mark> {
        (0..9).map(|c| game.mark(c)).collect()
    }

    /// Tries every line of play against every best reply. Returns true if the player can ever win.
    fn player_can_win(x: u16, o: u16, player_to_move: bool) -> bool {
        if line_of(o).is_some() {
            return true;
        }
        if line_of(x).is_some() || x | o == ALL {
            return false;
        }
        let free = ALL & !(x | o);
        let moves = if player_to_move { free } else { best_moves(x, o) };
        (0..9).filter(|c| moves & (1 << c) != 0).any(|c| {
            if player_to_move { player_can_win(x, o | 1 << c, false) } else { player_can_win(x | 1 << c, o, true) }
        })
    }

    #[test]
    fn perfect_play_never_loses_whoever_opens() {
        assert!(!player_can_win(0, 0, true));
        assert!(!player_can_win(0, 0, false));
    }

    /// The same search through the real game, with its timing and its dice.
    fn machine_ever_loses(game: &BertieGame) -> bool {
        match game.over() {
            Some(Outcome::Win) => return true,
            Some(_) => return false,
            None => {}
        }
        (0..9).filter(|&c| game.mark(c) == Mark::Empty).any(|c| {
            let mut next = game.clone();
            assert!(next.press(c));
            settle(&mut next);
            machine_ever_loses(&next)
        })
    }

    #[test]
    fn top_level_never_loses_a_real_game() {
        for seed in 1..40 {
            for player_opens in [true, false] {
                let mut game = BertieGame::new(seed);
                game.set_level(PERFECT);
                game.start(player_opens);
                settle(&mut game);
                assert!(!machine_ever_loses(&game), "seed {seed}, player opens: {player_opens}");
            }
        }
    }

    /// A player who always takes a best square, against the dial at `level`.
    fn careful_player_results(level: u8, games: u32) -> (u32, u32, u32) {
        let mut game = BertieGame::new(0xBE27);
        game.set_level(level);
        game.start(true);
        for _ in 0..games {
            while game.over().is_none() {
                settle(&mut game);
                if game.over().is_none() {
                    let cell = best_moves(game.o, game.x).trailing_zeros() as usize;
                    assert!(game.press(cell));
                }
            }
            game.reset();
        }
        (game.wins, game.losses, game.draws)
    }

    #[test]
    fn easy_level_can_be_beaten() {
        let (wins, losses, _) = careful_player_results(0, 200);
        assert!(wins > 100, "only {wins} wins in 200 games at the gentlest level");
        assert_eq!(losses, 0, "a careful player never loses");
    }

    #[test]
    fn each_notch_is_harder_than_the_last() {
        let wins: Vec<u32> = (0..LEVELS).map(|level| careful_player_results(level, 400).0).collect();
        assert!(wins.windows(2).all(|w| w[0] > w[1]), "wins by level: {wins:?}");
        assert_eq!(wins[PERFECT as usize], 0);
    }

    #[test]
    fn a_row_wins_for_the_player() {
        let mut game = BertieGame::new(1);
        // Place the marks by hand, so the machine's choices do not matter.
        game.o = 0b000_000_011;
        game.x = 0b000_011_000;
        game.events = 0;
        assert!(game.press(2));
        assert_eq!(game.over(), Some(Outcome::Win));
        assert_eq!(game.winning_line(), Some([0, 1, 2]));
        assert_eq!(game.events, EV_KEY | EV_WIN);
        assert_eq!(game.signs(), Signs { win: true, ..Signs::default() });
        assert_eq!(game.wins, 1);
    }

    #[test]
    fn the_machine_takes_a_win_when_it_has_one() {
        let mut game = BertieGame::new(1);
        game.set_level(PERFECT);
        game.x = 0b100_010_000;
        game.o = 0b000_000_110;
        game.phase = Phase::Thinking(0.2);
        game.events = 0;
        game.step(0.1);
        assert!(game.signs().machine);
        assert_eq!(game.events, 0);
        game.step(0.2);
        assert_eq!(game.mark(0), Mark::X);
        assert_eq!(game.over(), Some(Outcome::Lose));
        assert_eq!(game.winning_line(), Some([0, 4, 8]));
        assert_eq!(game.events, EV_LAMP | EV_LOSE);
        assert!(game.signs().lose);
    }

    #[test]
    fn a_full_board_with_no_row_is_a_draw() {
        let mut game = BertieGame::new(1);
        // X O X / X O O / O X . with the player to fill the last square.
        game.x = 0b010_001_101;
        game.o = 0b001_110_010;
        assert!(game.press(8));
        assert_eq!(game.over(), Some(Outcome::Draw));
        assert_eq!(game.winning_line(), None);
        assert!(game.signs().draw);
        assert_eq!(game.draws, 1);
    }

    #[test]
    fn every_line_is_seen() {
        for line in LINES {
            assert_eq!(line.count_ones(), 3);
            assert_eq!(line_of(line), Some(line));
            // Two of the three are not a line.
            assert_eq!(line_of(line & (line - 1)), None);
        }
        assert_eq!(line_of(0b101_010_010), None);
    }

    #[test]
    fn illegal_presses_are_ignored() {
        let mut game = BertieGame::new(7);
        assert!(game.press(4));
        // The machine is thinking: nothing may be pressed.
        let before = board(&game);
        game.events = 0;
        assert!(!game.press(0));
        assert_eq!(board(&game), before);
        assert_eq!(game.events, EV_REFUSED);
        settle(&mut game);
        // A taken square, the machine's or the player's own, and a key that does not exist.
        let before = board(&game);
        let taken = (0..9).find(|&c| game.mark(c) == Mark::X).unwrap();
        assert!(!game.press(taken));
        assert!(!game.press(4));
        assert!(!game.press(9));
        assert_eq!(board(&game), before);
        assert_eq!(game.phase(), Phase::PlayerTurn);
        // After the game is over the keys are dead until a reset.
        game.x = 0;
        game.o = 0b000_000_011;
        assert!(game.press(2));
        let before = board(&game);
        assert!(!game.press(5));
        assert_eq!(board(&game), before);
        assert_eq!(game.over(), Some(Outcome::Win));
    }

    #[test]
    fn reset_clears_the_board_and_swaps_the_opener() {
        let mut game = BertieGame::new(3);
        assert!(game.press(0));
        settle(&mut game);
        game.events = 0;
        game.reset();
        assert_eq!(game.events, EV_RESET);
        assert!(board(&game).iter().all(|&m| m == Mark::Empty));
        // The player opened the first game, so the machine opens this one.
        assert!(game.signs().machine);
        assert!((0..9).all(|c| !game.key_lit(c)));
        settle(&mut game);
        assert_eq!(board(&game).iter().filter(|&&m| m == Mark::X).count(), 1);
        assert!(game.signs().player);
        game.reset();
        assert!(game.signs().player);
        assert!((0..9).all(|c| game.key_lit(c)));
    }

    #[test]
    fn the_winning_three_flash() {
        let mut game = BertieGame::new(1);
        game.o = 0b000_000_011;
        game.x = 0b000_011_000;
        assert!(game.press(2));
        let mut seen = [false; 2];
        for _ in 0..40 {
            game.step(0.05);
            seen[(game.lamp(0) == Mark::O) as usize] = true;
            // Squares off the line stay steady.
            assert_eq!(game.lamp(3), Mark::X);
            assert_eq!(game.mark(0), Mark::O);
        }
        assert_eq!(seen, [true, true]);
    }

    #[test]
    fn the_dial_stops_at_both_ends() {
        let mut game = BertieGame::new(1);
        game.events = 0;
        game.turn_dial(-10);
        assert_eq!(game.level(), 0);
        assert_eq!(game.events, EV_DIAL);
        game.events = 0;
        game.turn_dial(-1);
        assert_eq!(game.events, 0);
        game.turn_dial(99);
        assert_eq!(game.level(), PERFECT);
    }
}
