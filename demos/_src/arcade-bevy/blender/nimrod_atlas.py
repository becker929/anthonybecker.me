"""Where each picture sits in blender/tex_nimrod/parts.jpg, in pixels from the top left of a 1024 square.

Shared by nimrod.py, which maps parts onto it, and nimrod_textures.py, which paints it.
"""

ATLAS = {
    # Generated: the glass of one lamp, and one round button cap seen from above.
    "lens": (4, 4, 252, 252),
    "cap": (260, 4, 508, 252),
    # The machine's name, as on the plate under the marquee.
    "maker": (516, 4, 1020, 130),
    # The four legends on the face, 4:1. Words glow when lit; the field stays dark.
    "opponents_move": (4, 264, 508, 388),
    "computers_move": (516, 264, 1020, 388),
    "opponent_wins": (4, 396, 508, 520),
    "computer_wins": (516, 396, 1020, 520),
    # The instruction panel's eight lines, 4:1, in the order of the game's I_ constants.
    "instr_0": (4, 532, 252, 594),
    "instr_1": (4, 600, 252, 662),
    "instr_2": (4, 668, 252, 730),
    "instr_3": (4, 736, 252, 798),
    "instr_4": (260, 532, 508, 594),
    "instr_5": (260, 600, 508, 662),
    "instr_6": (260, 668, 508, 730),
    "instr_7": (260, 736, 508, 798),
    # Engraved steel plates for the desk and the panels.
    "simple": (516, 532, 764, 594),
    "reverse": (772, 532, 1020, 594),
    "new_game": (516, 600, 764, 662),
    "comp_move": (772, 600, 1020, 662),
    "head_4": (516, 668, 578, 730),
    "head_2": (584, 668, 646, 730),
    "head_1": (652, 668, 714, 730),
    "odd": (720, 668, 844, 730),
    "instructions": (4, 808, 508, 870),
    "registers": (516, 808, 1020, 870),
    "heap_1": (516, 736, 578, 798),
    "heap_2": (584, 736, 646, 798),
    "heap_3": (652, 736, 714, 798),
    "heap_4": (720, 736, 782, 798),
}

INSTRUCTION_WORDS = ["READ HEAPS", "TEST FOURS", "TEST TWOS", "TEST ONES", "END GAME TEST", "SELECT HEAP", "TAKE ONE", "ALTER HEAP"]
