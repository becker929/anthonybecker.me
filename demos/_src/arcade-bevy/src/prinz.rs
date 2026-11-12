//! Dietrich Prinz's chess program (1951): mate-in-two problems on the Ferranti Mark 1.
//!
//! This is the logic only. It knows nothing of Bevy, so it can be tested on its own:
//!
//! ```text
//! rustc --edition 2024 --test src/prinz.rs -o /tmp/prinz_test && /tmp/prinz_test
//! ```
//!
//! What the real program did. Dietrich Prinz, of Ferranti, wrote it for the Ferranti Mark 1 at
//! Manchester University, and it first ran in November 1951. It could not play a game. It was given a
//! position with White to move and searched every White move, every Black answer and every White
//! second move for a mate in two. It knew nothing of castling, double pawn steps, en passant or
//! promotion, and did not tell mate from stalemate. Its best known problem took about fifteen minutes.
//!
//! The homage turns that round: the machine sets the problem and the visitor solves it. The
//! visitor plays White's first move (the key). The machine then does what Prinz's program did:
//! it searches every Black answer and every White mate, and plays Black's best defence. If the key
//! was wrong it finds the answer that leaves no mate, plays it, and the problem resets. If the
//! key was right the visitor plays the mate and the lamps confirm it.
//!
//! Sources:
//! - https://en.wikipedia.org/wiki/Chess_(Dietrich_Prinz)
//! - https://en.wikipedia.org/wiki/Dietrich_Prinz
//! - https://www.chessprogramming.org/Mate-in-two (Prinz's position, FEN 5Kbk/6pp/6P1/8/8/8/8/7R w,
//!   his limits, and the fifteen minutes), citing D. Prinz, "Robot Chess", Research 6 (1952), and
//!   "The Use of General Computers for Solving Logical Problems" in B. V. Bowden (ed.), Faster Than
//!   Thought (1953).
//! - https://en.wikipedia.org/wiki/Chess_problem (the Taverner and Heathcote problems below).
//!
//! The engine here is a full one for these positions: every piece's moves, check, checkmate and
//! stalemate told apart, double pawn steps, and promotion to any piece (the visitor's pawns become
//! queens). Castling and en passant are left out. No problem needs them: the tests check that no
//! king and rook stand where castling could arise and that no double step ever leaves an en passant
//! capture possible anywhere in a solution.
//!
//! Squares are numbered 0 to 63, a1 = 0, b1 = 1, ... h8 = 63. White is at the player's side.

/// What stands on a square. 0 is empty; 1 to 6 are White's pawn to king; adding `BLACK` makes it Black's.
pub type Piece = u8;
pub const EMPTY: Piece = 0;
pub const PAWN: Piece = 1;
pub const KNIGHT: Piece = 2;
pub const BISHOP: Piece = 3;
pub const ROOK: Piece = 4;
pub const QUEEN: Piece = 5;
pub const KING: Piece = 6;
pub const BLACK: Piece = 8;

/// The kind of a piece, without its colour.
pub fn kind(p: Piece) -> Piece {
    p & 7
}

pub fn is_black(p: Piece) -> bool {
    p & BLACK != 0
}

fn is_white(p: Piece) -> bool {
    p != EMPTY && p & BLACK == 0
}

/// One move. `promo` is the kind a pawn becomes on the last rank, or 0.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Move {
    pub from: u8,
    pub to: u8,
    pub promo: Piece,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Position {
    pub sq: [Piece; 64],
    pub white_to_move: bool,
}

const KNIGHT_STEPS: [(i8, i8); 8] = [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)];
const KING_STEPS: [(i8, i8); 8] = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)];
const ROOK_DIRS: [(i8, i8); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];
const BISHOP_DIRS: [(i8, i8); 4] = [(1, 1), (1, -1), (-1, 1), (-1, -1)];

/// The square `steps` away from `sq` as (files, ranks), if it is on the board.
fn offset(sq: u8, (df, dr): (i8, i8)) -> Option<u8> {
    let f = (sq % 8) as i8 + df;
    let r = (sq / 8) as i8 + dr;
    ((0..8).contains(&f) && (0..8).contains(&r)).then(|| (r * 8 + f) as u8)
}

impl Position {
    /// Reads the board and side to move of a FEN record. Castling and en passant fields are ignored.
    pub fn from_fen(fen: &str) -> Position {
        let mut parts = fen.split_whitespace();
        let mut sq = [EMPTY; 64];
        let (mut f, mut r) = (0i32, 7i32);
        for c in parts.next().unwrap_or("").chars() {
            match c {
                '/' => {
                    r -= 1;
                    f = 0;
                }
                '1'..='8' => f += c as i32 - '0' as i32,
                _ => {
                    let k = match c.to_ascii_lowercase() {
                        'p' => PAWN,
                        'n' => KNIGHT,
                        'b' => BISHOP,
                        'r' => ROOK,
                        'q' => QUEEN,
                        'k' => KING,
                        _ => panic!("bad FEN piece {c}"),
                    };
                    sq[(r * 8 + f) as usize] = if c.is_ascii_lowercase() { k | BLACK } else { k };
                    f += 1;
                }
            }
        }
        Position { sq, white_to_move: parts.next() != Some("b") }
    }

    fn king(&self, white: bool) -> Option<u8> {
        let k = if white { KING } else { KING | BLACK };
        self.sq.iter().position(|&p| p == k).map(|i| i as u8)
    }

    /// Whether `sq` is attacked by the side `by_white`.
    pub fn attacked(&self, sq: u8, by_white: bool) -> bool {
        let own = |p: Piece| if by_white { is_white(p) } else { is_black(p) };
        // A pawn attacks diagonally forward, so look diagonally backward from the square.
        let back = if by_white { -1 } else { 1 };
        for df in [-1, 1] {
            if let Some(s) = offset(sq, (df, back)) {
                let p = self.sq[s as usize];
                if own(p) && kind(p) == PAWN {
                    return true;
                }
            }
        }
        for step in KNIGHT_STEPS {
            if let Some(s) = offset(sq, step) {
                let p = self.sq[s as usize];
                if own(p) && kind(p) == KNIGHT {
                    return true;
                }
            }
        }
        for step in KING_STEPS {
            if let Some(s) = offset(sq, step) {
                let p = self.sq[s as usize];
                if own(p) && kind(p) == KING {
                    return true;
                }
            }
        }
        for (dirs, slider) in [(ROOK_DIRS, ROOK), (BISHOP_DIRS, BISHOP)] {
            for d in dirs {
                let mut at = sq;
                while let Some(s) = offset(at, d) {
                    let p = self.sq[s as usize];
                    if p != EMPTY {
                        if own(p) && (kind(p) == slider || kind(p) == QUEEN) {
                            return true;
                        }
                        break;
                    }
                    at = s;
                }
            }
        }
        false
    }

    /// Whether the side `white` has its king in check.
    pub fn in_check(&self, white: bool) -> bool {
        self.king(white).is_some_and(|k| self.attacked(k, !white))
    }

    /// Moves that obey how the pieces move, before asking whether they leave the king in check.
    fn pseudo_moves(&self) -> Vec<Move> {
        let white = self.white_to_move;
        let own = |p: Piece| if white { is_white(p) } else { is_black(p) };
        let foe = |p: Piece| if white { is_black(p) } else { is_white(p) };
        let mut out = Vec::new();
        for from in 0..64u8 {
            let p = self.sq[from as usize];
            if !own(p) {
                continue;
            }
            match kind(p) {
                PAWN => {
                    let fwd = if white { 1 } else { -1 };
                    let last = if white { 7 } else { 0 };
                    let start = if white { 1 } else { 6 };
                    let push = |to: u8, out: &mut Vec<Move>| {
                        if to / 8 == last {
                            for promo in [QUEEN, ROOK, BISHOP, KNIGHT] {
                                out.push(Move { from, to, promo });
                            }
                        } else {
                            out.push(Move { from, to, promo: 0 });
                        }
                    };
                    if let Some(one) = offset(from, (0, fwd)) {
                        if self.sq[one as usize] == EMPTY {
                            push(one, &mut out);
                            if from / 8 == start {
                                if let Some(two) = offset(one, (0, fwd)) {
                                    if self.sq[two as usize] == EMPTY {
                                        out.push(Move { from, to: two, promo: 0 });
                                    }
                                }
                            }
                        }
                    }
                    for df in [-1, 1] {
                        if let Some(to) = offset(from, (df, fwd)) {
                            if foe(self.sq[to as usize]) {
                                push(to, &mut out);
                            }
                        }
                    }
                }
                KNIGHT | KING => {
                    let steps = if kind(p) == KNIGHT { KNIGHT_STEPS } else { KING_STEPS };
                    for step in steps {
                        if let Some(to) = offset(from, step) {
                            if !own(self.sq[to as usize]) {
                                out.push(Move { from, to, promo: 0 });
                            }
                        }
                    }
                }
                k => {
                    let dirs: &[(i8, i8)] = match k {
                        ROOK => &ROOK_DIRS,
                        BISHOP => &BISHOP_DIRS,
                        _ => &KING_STEPS,
                    };
                    for &d in dirs {
                        let mut at = from;
                        while let Some(to) = offset(at, d) {
                            let q = self.sq[to as usize];
                            if own(q) {
                                break;
                            }
                            out.push(Move { from, to, promo: 0 });
                            if q != EMPTY {
                                break;
                            }
                            at = to;
                        }
                    }
                }
            }
        }
        out
    }

    /// The position after a move. It does not check that the move is legal.
    pub fn play(&self, m: Move) -> Position {
        let mut next = *self;
        let p = next.sq[m.from as usize];
        next.sq[m.from as usize] = EMPTY;
        next.sq[m.to as usize] = if m.promo != 0 { m.promo | (p & BLACK) } else { p };
        next.white_to_move = !self.white_to_move;
        next
    }

    /// Every legal move for the side to move.
    pub fn legal_moves(&self) -> Vec<Move> {
        let white = self.white_to_move;
        self.pseudo_moves().into_iter().filter(|&m| !self.play(m).in_check(white)).collect()
    }

    pub fn is_checkmate(&self) -> bool {
        self.in_check(self.white_to_move) && self.legal_moves().is_empty()
    }

    pub fn is_stalemate(&self) -> bool {
        !self.in_check(self.white_to_move) && self.legal_moves().is_empty()
    }

    /// The moves that mate at once.
    pub fn mates(&self) -> Vec<Move> {
        self.legal_moves().into_iter().filter(|&m| self.play(m).is_checkmate()).collect()
    }

    /// Whether the side to move mates in `n` moves or fewer, against every defence.
    pub fn mates_in(&self, n: u32) -> bool {
        self.legal_moves().into_iter().any(|m| self.play(m).forced(n))
    }

    /// After the attacker's move: whether the defender, to move here, is mated within `n` moves of
    /// the attacker's counting from the move just made.
    fn forced(&self, n: u32) -> bool {
        let replies = self.legal_moves();
        if replies.is_empty() {
            return self.in_check(self.white_to_move);
        }
        n > 1 && replies.into_iter().all(|r| self.play(r).mates_in(n - 1))
    }

    /// Every first move that mates in `n` or fewer against every defence. A problem has one.
    pub fn keys(&self, n: u32) -> Vec<Move> {
        self.legal_moves().into_iter().filter(|&m| self.play(m).forced(n)).collect()
    }
}

/// A move in the usual short notation, such as "Rh6", "gxh6" or "e8=Q". Check signs are left off.
pub fn notation(pos: &Position, m: Move) -> String {
    let p = pos.sq[m.from as usize];
    let file = |s: u8| (b'a' + s % 8) as char;
    let square = |s: u8| format!("{}{}", file(s), s / 8 + 1);
    let capture = pos.sq[m.to as usize] != EMPTY;
    let letter = |k: Piece| ['?', 'P', 'N', 'B', 'R', 'Q', 'K'][k as usize];
    let mut s = String::new();
    if kind(p) == PAWN {
        if capture {
            s.push(file(m.from));
            s.push('x');
        }
        s += &square(m.to);
        if m.promo != 0 {
            s.push('=');
            s.push(letter(m.promo));
        }
    } else {
        s.push(letter(kind(p)));
        // Say which piece when two of a kind could go there.
        let twins: Vec<Move> =
            pos.legal_moves().into_iter().filter(|o| o.to == m.to && o.from != m.from && pos.sq[o.from as usize] == p).collect();
        if !twins.is_empty() {
            if twins.iter().all(|o| o.from % 8 != m.from % 8) {
                s.push(file(m.from));
            } else if twins.iter().all(|o| o.from / 8 != m.from / 8) {
                s.push((b'1' + m.from / 8) as char);
            } else {
                s += &square(m.from);
            }
        }
        if capture {
            s.push('x');
        }
        s += &square(m.to);
    }
    s
}

// ---------------------------------------------------------------- the problems

/// One mate-in-two problem: White to move and mate in two.
pub struct Problem {
    pub fen: &'static str,
    /// Who made it, and when.
    pub by: &'static str,
    /// The key, in short notation, as the tests find it.
    pub key: &'static str,
    /// What solving it is worth, 1 to 5: harder problems are worth more.
    pub points: u32,
}

/// The problems, easiest first. The machine sets them in this order and starts again after the last.
/// "Composed for this machine" means found by a search over random positions with this file's engine
/// (every one with a single key, no mate in one, and a mate after every defence), then chosen and
/// ordered by hand in November 2026.
pub const PROBLEMS: &[Problem] = &[
    // PROBLEMS_START
    Problem { fen: "5Kbk/6pp/6P1/8/8/8/8/7R w - - 0 1", by: "Dietrich Prinz, 1951 (Robot Chess, 1952)", key: "Rh6", points: 1 },
    Problem { fen: "8/k7/6B1/8/2Q5/4K3/8/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Qc7", points: 1 },
    Problem { fen: "8/6k1/8/8/8/6K1/5R2/3Q4 w - - 0 1", by: "Composed for this machine, 2026", key: "Qg4", points: 1 },
    Problem { fen: "8/8/4K3/7k/R7/8/8/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Kf6", points: 2 },
    Problem { fen: "2k5/7P/K7/8/8/8/8/6R1 w - - 0 1", by: "Composed for this machine, 2026", key: "Rg7", points: 2 },
    Problem { fen: "4k3/8/5PP1/7K/R7/8/8/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Rd4", points: 2 },
    Problem { fen: "1k6/8/2Kp1p2/8/8/8/7Q/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Qh7", points: 3 },
    Problem { fen: "5k2/4R3/7K/5p2/8/8/2Q1p3/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Qc7", points: 3 },
    Problem { fen: "8/1R6/k7/8/8/5R2/4K2Q/4b3 w - - 0 1", by: "Composed for this machine, 2026", key: "Qb8", points: 3 },
    Problem { fen: "8/8/3n4/8/3Q1p2/3R4/8/4K2k w - - 0 1", by: "Composed for this machine, 2026", key: "Kf1", points: 4 },
    Problem { fen: "8/3b4/8/k1B5/B7/K3Q3/6p1/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Qb3", points: 4 },
    Problem { fen: "8/1Q5n/8/1PK5/2B5/2B5/8/2kr3R w - - 0 1", by: "Composed for this machine, 2026", key: "Bb3", points: 4 },
    Problem { fen: "4k3/K6Q/b7/8/8/3R4/3n4/8 w - - 0 1", by: "Composed for this machine, 2026", key: "Rd7", points: 4 },
    Problem { fen: "3brrb1/2N4B/8/2p4Q/2p2k2/5P2/4P1KR/2N2RB1 w - - 0 1", by: "Thomas Taverner, Dubuque Chess Journal, 1889 (1st prize)", key: "Rh1", points: 5 },
    Problem { fen: "6K1/pN2R1PQ/p7/r2k3r/N2n4/1P2p3/BB5p/2Rb2bq w - - 0 1", by: "Godfrey Heathcote, Hampstead and Highgate Express, 1905-06 (1st prize)", key: "Rcc7", points: 5 },
    // PROBLEMS_END
];

// ---------------------------------------------------------------- the game

/// What the visitor's last action did, and what the machine did, since the owner last looked. For
/// sounds. See `PrinzGame::events`.
/// A piece was picked up, or put back down where it stood.
pub const EV_SELECT: u32 = 1;
/// The visitor's piece was set down on a new square.
pub const EV_MOVE: u32 = 2;
/// A piece was taken, by either side.
pub const EV_CAPTURE: u32 = 4;
/// A square was pressed that could not be chosen.
pub const EV_REFUSED: u32 = 8;
/// The machine began to think.
pub const EV_THINK: u32 = 16;
/// The machine moved a Black piece.
pub const EV_REPLY: u32 = 32;
/// The visitor mated: the problem is solved.
pub const EV_MATE: u32 = 64;
/// The visitor's move was wrong. The machine has shown why.
pub const EV_REFUTED: u32 = 128;
/// The pieces went back to the problem's start.
pub const EV_RESET: u32 = 256;
/// A new problem was set.
pub const EV_NEXT: u32 = 512;

/// How long the machine thinks before it answers the key. The real one took minutes.
pub const THINK_TIME: f32 = 3.0;
/// How long a refutation stays on the board before the pieces go back.
pub const REFUTED_TIME: f32 = 2.6;
/// How long a mate stays on the board before the machine sets the next problem by itself.
pub const SOLVED_TIME: f32 = 6.0;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Phase {
    /// The visitor is to find the key.
    Key,
    /// The machine is searching. It will play `reply` (None if Black has no move), and then the
    /// visitor mates, or, if `refute`, the key is shown wrong.
    Thinking { left: f32, reply: Option<Move>, refute: bool },
    /// The visitor is to mate.
    Mate,
    /// The visitor mated. The number is the seconds since.
    Solved(f32),
    /// The visitor went wrong. The number is the seconds left before the pieces go back.
    Refuted(f32),
}

/// A move made on the board, for the owner to animate. See `PrinzGame::take_moves`.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Moved {
    pub from: u8,
    pub to: u8,
    /// What stood on `from`.
    pub piece: Piece,
    /// What was taken on `to`, or `EMPTY`.
    pub captured: Piece,
    /// What the piece became, if a pawn was promoted, or `EMPTY`.
    pub promo: Piece,
}

/// The result lamps.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Lamps {
    /// "White to play": the visitor is to move.
    pub white: bool,
    /// The machine is thinking.
    pub thinking: bool,
    /// "Mate": the problem is solved.
    pub mate: bool,
    /// "Refuted": the visitor's move was wrong.
    pub refuted: bool,
}

#[derive(Clone)]
struct Rng(u32);
impl Rng {
    fn below(&mut self, n: usize) -> usize {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        (self.0 as usize) % n.max(1)
    }
}

#[derive(Clone)]
pub struct PrinzGame {
    /// What has happened since the owner last looked, as `EV_` bits. The owner clears it.
    pub events: u32,
    problem: usize,
    start: Position,
    pos: Position,
    phase: Phase,
    selected: Option<u8>,
    moved: Vec<Moved>,
    /// Goes up whenever the board is set out afresh, so the owner can lay the pieces out again.
    version: u32,
    /// Problems solved in the run in progress, a bit each, and the run's score.
    solved: u64,
    streak: u32,
    ended: Option<u32>,
    rng: Rng,
}

impl PrinzGame {
    /// A machine with its first problem set.
    pub fn new(seed: u32) -> Self {
        let mut game = PrinzGame {
            events: 0,
            problem: 0,
            start: Position::from_fen(PROBLEMS[0].fen),
            pos: Position::from_fen(PROBLEMS[0].fen),
            phase: Phase::Key,
            selected: None,
            moved: Vec::new(),
            version: 0,
            solved: 0,
            streak: 0,
            ended: None,
            rng: Rng(seed | 1),
        };
        game.set(0);
        game.events = 0;
        game
    }

    /// Sets problem `i` on the board.
    fn set(&mut self, i: usize) {
        self.problem = i % PROBLEMS.len();
        self.start = Position::from_fen(PROBLEMS[self.problem].fen);
        self.reset_board();
        self.events |= EV_NEXT;
    }

    fn reset_board(&mut self) {
        self.pos = self.start;
        self.phase = Phase::Key;
        self.selected = None;
        self.moved.clear();
        self.version = self.version.wrapping_add(1);
        self.events |= EV_RESET;
    }

    /// The heavy button: the next problem. Skipping one that is not solved ends the run.
    pub fn next(&mut self) {
        if !matches!(self.phase, Phase::Solved(_)) {
            self.end_run();
        }
        self.set(self.problem + 1);
    }

    /// Ends the run of solved problems, as a wrong move, a skip or walking away does. Its score waits
    /// in `take_ended`.
    pub fn end_run(&mut self) {
        if self.streak > 0 {
            self.ended = Some(self.streak.min(5000));
        }
        self.streak = 0;
        self.solved = 0;
    }

    /// The score of a run that has ended, once.
    pub fn take_ended(&mut self) -> Option<u32> {
        self.ended.take()
    }

    /// The score of the run in progress: the points of every problem solved since the last mistake.
    pub fn streak(&self) -> u32 {
        self.streak
    }

    /// Which problem is set, from 0.
    pub fn problem(&self) -> usize {
        self.problem
    }

    /// Problems solved in the run in progress, a bit each.
    pub fn solved(&self) -> u64 {
        self.solved
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn board(&self) -> &[Piece; 64] {
        &self.pos.sq
    }

    pub fn piece(&self, sq: usize) -> Piece {
        self.pos.sq.get(sq).copied().unwrap_or(EMPTY)
    }

    pub fn selected(&self) -> Option<u8> {
        self.selected
    }

    /// Changes whenever the board is set out afresh.
    pub fn version(&self) -> u32 {
        self.version
    }

    /// Whether the visitor may move now.
    pub fn visitor_to_move(&self) -> bool {
        matches!(self.phase, Phase::Key | Phase::Mate)
    }

    /// The squares the selected piece may go to, a bit each, for the lamps.
    pub fn destinations(&self) -> u64 {
        let Some(from) = self.selected else { return 0 };
        self.pos.legal_moves().iter().filter(|m| m.from == from).fold(0, |bits, m| bits | 1 << m.to)
    }

    pub fn lamps(&self) -> Lamps {
        Lamps {
            white: self.visitor_to_move(),
            thinking: matches!(self.phase, Phase::Thinking { .. }),
            mate: matches!(self.phase, Phase::Solved(_)),
            refuted: matches!(self.phase, Phase::Refuted(_)),
        }
    }

    /// The moves made on the board since the owner last looked, oldest first.
    pub fn take_moves(&mut self) -> Vec<Moved> {
        std::mem::take(&mut self.moved)
    }

    /// The visitor presses a square: first the piece, then where it goes. Pressing the piece again
    /// puts it down; pressing another White piece picks that one up instead. Anything else is refused.
    pub fn press(&mut self, sq: usize) -> bool {
        if !self.visitor_to_move() || sq >= 64 {
            self.events |= EV_REFUSED;
            return false;
        }
        let sq = sq as u8;
        let p = self.pos.sq[sq as usize];
        let legal = self.pos.legal_moves();
        match self.selected {
            Some(from) if from == sq => {
                self.selected = None;
                self.events |= EV_SELECT;
                true
            }
            Some(from) if legal.iter().any(|m| m.from == from && m.to == sq) => {
                // The visitor's pawns become queens. No problem here needs anything else.
                let m = legal.iter().copied().find(|m| m.from == from && m.to == sq && (m.promo == 0 || m.promo == QUEEN)).unwrap();
                self.selected = None;
                self.visitor_moves(m);
                true
            }
            _ if is_white(p) && legal.iter().any(|m| m.from == sq) => {
                self.selected = Some(sq);
                self.events |= EV_SELECT;
                true
            }
            _ => {
                self.events |= EV_REFUSED;
                false
            }
        }
    }

    fn make(&mut self, m: Move) {
        let piece = self.pos.sq[m.from as usize];
        let captured = self.pos.sq[m.to as usize];
        self.pos = self.pos.play(m);
        let promo = if m.promo != 0 { self.pos.sq[m.to as usize] } else { EMPTY };
        self.moved.push(Moved { from: m.from, to: m.to, piece, captured, promo });
        if captured != EMPTY {
            self.events |= EV_CAPTURE;
        }
    }

    fn visitor_moves(&mut self, m: Move) {
        self.make(m);
        self.events |= EV_MOVE;
        if self.phase == Phase::Mate {
            if self.pos.is_checkmate() {
                self.solve();
            } else {
                self.refuted();
            }
            return;
        }
        // The key. A mate at once would also do; no problem has one.
        if self.pos.is_checkmate() {
            self.solve();
            return;
        }
        let replies = self.pos.legal_moves();
        if replies.is_empty() {
            // Stalemate: the key gave Black nothing to do, so there is nothing to mate.
            self.phase = Phase::Thinking { left: THINK_TIME, reply: None, refute: true };
            self.events |= EV_THINK;
            return;
        }
        let answers: Vec<(Move, usize)> = replies.iter().map(|&r| (r, self.pos.play(r).mates().len())).collect();
        let fewest = answers.iter().map(|a| a.1).min().unwrap();
        // The best defence leaves the fewest mates. If it leaves none, the key was wrong.
        let best: Vec<Move> = answers.iter().filter(|a| a.1 == fewest).map(|a| a.0).collect();
        let reply = best[self.rng.below(best.len())];
        self.phase = Phase::Thinking { left: THINK_TIME, reply: Some(reply), refute: fewest == 0 };
        self.events |= EV_THINK;
    }

    fn solve(&mut self) {
        self.phase = Phase::Solved(0.0);
        self.events |= EV_MATE;
        if self.solved & (1 << self.problem) == 0 {
            self.solved |= 1 << self.problem;
            self.streak += PROBLEMS[self.problem].points;
        }
    }

    fn refuted(&mut self) {
        self.phase = Phase::Refuted(REFUTED_TIME);
        self.events |= EV_REFUTED;
        self.end_run();
    }

    /// Advances time by `dt` seconds.
    pub fn step(&mut self, dt: f32) {
        match self.phase {
            Phase::Thinking { left, reply, refute } if left > dt => {
                self.phase = Phase::Thinking { left: left - dt, reply, refute };
            }
            Phase::Thinking { reply, refute, .. } => {
                if let Some(r) = reply {
                    self.make(r);
                    self.events |= EV_REPLY;
                }
                if refute {
                    self.refuted();
                } else {
                    self.phase = Phase::Mate;
                }
            }
            Phase::Refuted(left) if left > dt => self.phase = Phase::Refuted(left - dt),
            Phase::Refuted(_) => self.reset_board(),
            Phase::Solved(t) if t + dt < SOLVED_TIME => self.phase = Phase::Solved(t + dt),
            Phase::Solved(_) => self.set(self.problem + 1),
            Phase::Key | Phase::Mate => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sq(name: &str) -> usize {
        let b = name.as_bytes();
        ((b[1] - b'1') * 8 + (b[0] - b'a')) as usize
    }

    /// Whether a move can be entered by the visitor: not a promotion to anything but a queen.
    fn enterable(m: &Move) -> bool {
        m.promo == 0 || m.promo == QUEEN
    }

    /// The moves that matter for en passant: every first move, every answer to it, and every second
    /// move that the engine counts as mate (an en passant capture could escape it). A double step at
    /// White's second move that is not mate ends the attempt anyway.
    fn tree(start: &Position) -> Vec<(Position, Move)> {
        let mut out = Vec::new();
        for k in start.legal_moves() {
            let a = start.play(k);
            out.push((*start, k));
            for d in a.legal_moves() {
                out.push((a, d));
                let b = a.play(d);
                for m in b.legal_moves() {
                    if b.play(m).is_checkmate() {
                        out.push((b, m));
                    }
                }
            }
        }
        out
    }

    #[test]
    fn every_problem_has_one_key_and_mates_after_every_defence() {
        for (i, p) in PROBLEMS.iter().enumerate() {
            let pos = Position::from_fen(p.fen);
            assert!(pos.white_to_move, "problem {i}: White must be to move");
            assert!(!pos.in_check(false), "problem {i}: Black is in check while White is to move");
            assert!(!pos.mates_in(1), "problem {i}: there is a mate in one");
            let keys = pos.keys(2);
            assert_eq!(keys.len(), 1, "problem {i} ({}): keys {:?}", p.by, keys.iter().map(|&k| notation(&pos, k)).collect::<Vec<_>>());
            let key = keys[0];
            assert!(enterable(&key), "problem {i}: the key is an underpromotion");
            assert_eq!(notation(&pos, key), p.key, "problem {i}: the key's notation");
            let after = pos.play(key);
            let defences = after.legal_moves();
            assert!(!defences.is_empty(), "problem {i}: the key leaves Black no move");
            for d in defences {
                let mates = after.play(d).mates();
                assert!(mates.iter().any(enterable), "problem {i}: no mate the visitor can enter after {}", notation(&after, d));
            }
            assert!((1..=5).contains(&p.points), "problem {i}: points");
        }
    }

    #[test]
    fn no_problem_could_need_castling_or_en_passant() {
        for (i, p) in PROBLEMS.iter().enumerate() {
            let pos = Position::from_fen(p.fen);
            for (white, home, corners) in [(true, 4usize, [0usize, 7]), (false, 60, [56, 63])] {
                let (k, r) = if white { (KING, ROOK) } else { (KING | BLACK, ROOK | BLACK) };
                let could = pos.sq[home] == k && corners.iter().any(|&c| pos.sq[c] == r);
                assert!(!could, "problem {i}: a king and rook stand where castling could be claimed");
            }
            for (before, m) in tree(&pos) {
                let p = before.sq[m.from as usize];
                if kind(p) == PAWN && (m.to as i32 - m.from as i32).abs() == 16 {
                    let enemy = if is_black(p) { PAWN } else { PAWN | BLACK };
                    for df in [-1, 1] {
                        if let Some(s) = offset(m.to, (df, 0)) {
                            assert_ne!(before.sq[s as usize], enemy, "problem {i}: a double step allows en passant");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn problems_get_no_easier() {
        let points: Vec<u32> = PROBLEMS.iter().map(|p| p.points).collect();
        assert!(PROBLEMS.len() >= 12, "only {} problems", PROBLEMS.len());
        assert!(points.windows(2).all(|w| w[0] <= w[1]), "points {points:?}");
    }

    #[test]
    fn check_mate_and_stalemate() {
        // Fool's mate.
        let p = Position::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w");
        assert!(p.is_checkmate());
        let s = Position::from_fen("7k/5Q2/6K1/8/8/8/8/8 b");
        assert!(s.is_stalemate() && !s.is_checkmate());
        // A pinned piece may not move off its line.
        let pin = Position::from_fen("4k3/4r3/8/8/8/8/4R3/4K3 b");
        assert!(pin.legal_moves().iter().filter(|m| m.from as usize == sq("e7")).all(|m| m.to % 8 == 4));
        // Promotion makes four moves, and a double step needs both squares empty.
        let promo = Position::from_fen("8/P6k/8/8/8/8/8/K7 w");
        assert_eq!(promo.legal_moves().iter().filter(|m| m.from as usize == sq("a7")).count(), 4);
        let blocked = Position::from_fen("k7/8/8/8/8/4n3/4P3/K7 w");
        assert!(!blocked.legal_moves().iter().any(|m| m.from as usize == sq("e2")));
    }

    #[test]
    fn prinz_position_is_solved_by_rook_h6() {
        let pos = Position::from_fen(PROBLEMS[0].fen);
        let keys = pos.keys(2);
        assert_eq!(keys, vec![Move { from: sq("h1") as u8, to: sq("h6") as u8, promo: 0 }]);
    }

    /// Plays the problem through the game: the key, the machine's answer, then a mate.
    fn solve(game: &mut PrinzGame) {
        let pos = Position::from_fen(PROBLEMS[game.problem()].fen);
        let key = pos.keys(2)[0];
        assert!(game.press(key.from as usize));
        assert!(game.press(key.to as usize));
        assert!(matches!(game.phase(), Phase::Thinking { refute: false, .. }));
        game.step(THINK_TIME + 0.1);
        assert_eq!(game.phase(), Phase::Mate);
        let here = Position { sq: *game.board(), white_to_move: true };
        let mate = here.mates().into_iter().find(enterable).unwrap();
        assert!(game.press(mate.from as usize));
        assert!(game.press(mate.to as usize));
        assert!(matches!(game.phase(), Phase::Solved(_)));
    }

    #[test]
    fn every_problem_can_be_solved_through_the_game() {
        let mut game = PrinzGame::new(7);
        for i in 0..PROBLEMS.len() {
            assert_eq!(game.problem(), i);
            solve(&mut game);
            assert!(game.events & EV_MATE != 0);
            game.events = 0;
            game.next();
        }
        assert_eq!(game.problem(), 0, "it starts again after the last");
        assert_eq!(game.streak(), PROBLEMS.iter().map(|p| p.points).sum::<u32>());
    }

    #[test]
    fn the_machine_answers_with_the_defence_that_leaves_fewest_mates() {
        for seed in 1..20 {
            let mut game = PrinzGame::new(seed);
            for _ in 0..PROBLEMS.len() {
                let pos = Position::from_fen(PROBLEMS[game.problem()].fen);
                let key = pos.keys(2)[0];
                let after = pos.play(key);
                let fewest = after.legal_moves().iter().map(|&d| after.play(d).mates().len()).min().unwrap();
                game.press(key.from as usize);
                game.press(key.to as usize);
                game.step(THINK_TIME + 0.1);
                let here = Position { sq: *game.board(), white_to_move: true };
                assert_eq!(here.mates().len(), fewest);
                game.next();
            }
        }
    }

    #[test]
    fn a_wrong_key_is_refuted_and_the_problem_resets() {
        let mut game = PrinzGame::new(3);
        solve(&mut game);
        game.next();
        let start = *game.board();
        let pos = Position::from_fen(PROBLEMS[1].fen);
        let key = pos.keys(2)[0];
        let wrong = pos.legal_moves().into_iter().find(|&m| m != key && enterable(&m)).unwrap();
        game.events = 0;
        game.press(wrong.from as usize);
        game.press(wrong.to as usize);
        assert!(matches!(game.phase(), Phase::Thinking { refute: true, .. }));
        assert!(game.lamps().thinking);
        game.step(THINK_TIME + 0.1);
        assert!(matches!(game.phase(), Phase::Refuted(_)));
        assert!(game.lamps().refuted && !game.lamps().white);
        assert!(game.events & EV_REFUTED != 0);
        // The run ended with the first problem's points.
        assert_eq!(game.take_ended(), Some(PROBLEMS[0].points));
        assert_eq!(game.take_ended(), None);
        // Pressing does nothing while the refutation is shown.
        assert!(!game.press(wrong.from as usize));
        game.step(REFUTED_TIME + 0.1);
        assert_eq!(game.phase(), Phase::Key);
        assert_eq!(game.board(), &start);
        assert_eq!(game.problem(), 1);
    }

    #[test]
    fn a_wrong_mate_is_refuted() {
        let mut game = PrinzGame::new(5);
        let pos = Position::from_fen(PROBLEMS[0].fen);
        let key = pos.keys(2)[0];
        game.press(key.from as usize);
        game.press(key.to as usize);
        game.step(THINK_TIME + 0.1);
        let here = Position { sq: *game.board(), white_to_move: true };
        let not_mate = here.legal_moves().into_iter().find(|&m| !here.play(m).is_checkmate() && enterable(&m)).unwrap();
        game.press(not_mate.from as usize);
        game.press(not_mate.to as usize);
        assert!(matches!(game.phase(), Phase::Refuted(_)));
    }

    #[test]
    fn selection_and_refusals() {
        let mut game = PrinzGame::new(1);
        let (rook, king, black_bishop, empty) = (sq("h1"), sq("f8"), sq("g8"), sq("a1"));
        assert!(!game.press(black_bishop), "Black's pieces cannot be picked up");
        assert!(!game.press(empty));
        assert!(game.events & EV_REFUSED != 0);
        assert!(game.press(rook));
        assert_eq!(game.selected(), Some(rook as u8));
        assert!(game.destinations() & (1 << sq("h6")) != 0);
        assert!(game.destinations() & (1 << sq("g2")) == 0);
        // An illegal square is refused and the piece stays picked up.
        assert!(!game.press(sq("g2")));
        assert_eq!(game.selected(), Some(rook as u8));
        // Another White piece takes over the selection; pressing it again puts it down.
        assert!(game.press(king));
        assert_eq!(game.selected(), Some(king as u8));
        assert!(game.press(king));
        assert_eq!(game.selected(), None);
        assert_eq!(game.destinations(), 0);
    }

    #[test]
    fn moves_are_reported_for_animation() {
        let mut game = PrinzGame::new(1);
        game.take_moves();
        game.press(sq("h1"));
        game.press(sq("h6"));
        let moves = game.take_moves();
        assert_eq!(moves, vec![Moved { from: sq("h1") as u8, to: sq("h6") as u8, piece: ROOK, captured: EMPTY, promo: EMPTY }]);
        game.step(THINK_TIME + 0.1);
        assert_eq!(game.take_moves().len(), 1);
        let v = game.version();
        game.next();
        assert_ne!(game.version(), v);
    }

    #[test]
    fn skipping_ends_the_run_and_a_solved_problem_moves_on_by_itself() {
        let mut game = PrinzGame::new(2);
        solve(&mut game);
        game.step(SOLVED_TIME + 0.1);
        assert_eq!(game.problem(), 1);
        assert_eq!(game.streak(), PROBLEMS[0].points);
        game.next();
        assert_eq!(game.take_ended(), Some(PROBLEMS[0].points));
        assert_eq!(game.problem(), 2);
    }
}
