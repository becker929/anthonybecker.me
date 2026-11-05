# Rung 2's slice (docs/rung2.md): carry a brass key from the far corner room to the capybara lab's locked door.
# The save goes to the player's own Bluesky repo (the game has an id). The scripting guide is FORMAT.md.

game = {
    "id": "anthonybecker.me:keys",
    "world": "https://world2.anthonybecker.me",
    "pins": [],
}

KEY = {"id": "key", "kind": "item", "name": "brass key", "cell": [4, 6], "pos": [-2.6, 0.7, -2.4]}
# the lab has two ways in, both locked; one key opens one of them
DOORS = [
    {"id": "gate", "cell": [6, 7], "door": "S"},
    {"id": "gate_w", "cell": [5, 8], "door": "E"},
]
LAB = [6, 8]

# the state is the save: where the key is (room, carried, used), the doors opened, the lab reached, the player's cell
state = {"key": "room", "open": [], "done": 0, "cell": []}

def on_load(state, data):
    # copy what the save says as known values (a save is data from outside: check it, don't trust its shape)
    for where in ["carried", "used"]:
        if data.get("key") == where:
            state["key"] = where
    state["done"] = 1 if data.get("done") == 1 else 0
    opened = data.get("open", [])
    emit("spawn", KEY)
    if state["key"] == "carried":
        emit("give", "key")
    elif state["key"] == "used":
        emit("lose", "key")
    for d in DOORS:
        # use: the player can try the door (on_use), while it is closed
        emit("spawn", {"id": d["id"], "kind": "barrier", "cell": d["cell"], "door": d["door"], "use": True})
        if d["id"] in opened:
            state["open"].append(d["id"])
            emit("open", d["id"])
    emit("spawn", {"id": "drone", "kind": "drone"})
    if state["done"] == 1:
        emit("drone", "follow")
    elif state["key"] != "room":
        emit("drone", "seek:barrier")
    # a save starts the player where they were
    cell = data.get("cell", [])
    if type(cell) == "list" and len(cell) == 2 and type(cell[0]) == "int" and type(cell[1]) == "int":
        state["cell"] = [cell[0], cell[1]]
        emit("place", state["cell"])

def on_use(state, ev):
    if ev["id"] == "key" and state["key"] == "room":
        state["key"] = "carried"
        emit("give", "key")
        emit("sound", "pickup")
        emit("drone", "seek:barrier")
        emit("say", "A brass key.")
    elif ev["kind"] == "barrier" and ev["id"] not in state["open"]:
        if state["key"] == "carried":
            state["key"] = "used"
            state["open"].append(ev["id"])
            emit("lose", "key")
            emit("open", ev["id"])
            emit("sound", "open")
            emit("say", "The key turns.")
        else:
            emit("say", "Locked.")

def on_enter(state, ev):
    state["cell"] = ev["cell"]
    if ev["cell"] == LAB and state["done"] == 0:
        state["done"] = 1
        emit("drone", "follow")
        emit("say", "The capybara was waiting for you.")
