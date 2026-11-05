# Five orbs. Find them all, with the drone's help after the first, and the way to the capybara opens.
# The scripting guide is FORMAT.md, next to this file.

game = {"name": "orbs"}

# where things are: a cell of the block and room-local metres (x, z in -6..6, y up)
ORBS = [
    {"id": "orb_moai", "cell": [5, 7], "pos": [-5.15, 0.9, -4.2]},
    {"id": "orb_altar", "cell": [4, 7], "pos": [0.52, 1.8, 0.18]},
    {"id": "orb_door", "cell": [4, 8], "pos": [-1.85, 1.0, -5.5]},
    {"id": "orb_far", "cell": [4, 6], "pos": [-2.6, 0.7, -2.4]},
    {"id": "orb_corner", "cell": [6, 6], "pos": [5.3, 0.4, -5.3]},
]
# the reward room has two ways in: a barrier across each
GATES = [
    {"id": "gate", "cell": [6, 7], "door": "S"},
    {"id": "gate_w", "cell": [5, 8], "door": "E"},
]
REWARD = [6, 8]

state = {"orbs": 0, "taken": [], "arrived": False}
caps = {"taken": 8}

def open_all():
    for g in GATES:
        emit("open", g["id"])

def on_load(state, data):
    # the world, as a save left it (data is {} for a fresh game)
    saved = data.get("taken", [])
    for o in ORBS:
        emit("spawn", {"id": o["id"], "kind": "orb", "cell": o["cell"], "pos": o["pos"]})
        if o["id"] in saved:
            state["taken"].append(o["id"])
            emit("take", o["id"])
    state["orbs"] = len(state["taken"])
    state["arrived"] = data.get("arrived", False) == True
    for g in GATES:
        emit("spawn", {"id": g["id"], "kind": "barrier", "cell": g["cell"], "door": g["door"]})
    emit("spawn", {"id": "drone", "kind": "drone"})
    if state["orbs"] == len(ORBS):
        open_all()
        emit("drone", "follow")
    elif state["orbs"] > 0:
        emit("drone", "seek:orb")

def on_use(state, ev):
    if ev["kind"] != "orb" or ev["id"] in state["taken"] or len(state["taken"]) >= len(ORBS):
        return
    state["taken"].append(ev["id"])
    state["orbs"] += 1
    emit("take", ev["id"])
    emit("sound", "pickup")
    if state["orbs"] == 1:
        emit("drone", "seek:orb")
        emit("sound", "wake")
    if state["orbs"] == len(ORBS):
        open_all()
        emit("drone", "follow")
        emit("sound", "open")
        emit("say", "The way is open.")

def on_enter(state, ev):
    if ev["cell"] == REWARD and not state["arrived"]:
        state["arrived"] = True
        emit("say", "The capybara was waiting for you.")

def save(state):
    # the count is the taken orbs: on_load counts them again
    return {"taken": state["taken"], "arrived": state["arrived"]}

def look_hud(state, ev):
    # the page's counter: a dot per orb, lit for each found
    return {"dots": len(ORBS), "lit": state["orbs"]}

def look_glow(state, ev):
    # the halos are the costliest thing the game draws: on the lowest tier, or when this frame has little headroom
    # (frames under about 30 per second), they shrink
    if tier() == 0 or budget() < 50000:
        return {"halo": 0.6}
    return {"halo": 1.0}
