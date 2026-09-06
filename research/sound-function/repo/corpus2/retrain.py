#!/usr/bin/env python3
"""Does a library of real in-genre hits (labelled by the model itself) help name the
sample-pack hits (labelled by file names)? Writes corpus2/retrain.json for part three,
and refreshes the meter's model when the all-domain model is at least as good on the
packs as the one it replaces.   python3 corpus2/retrain.py"""
import csv, json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from analysis.classify import load
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_val_predict, StratifiedKFold
ROOT = Path(__file__).resolve().parent; OUT = ROOT.parent / "out"
FEATS = json.load(open(OUT / "classifier_union.json"))["model"]["features"]   # the meter's seven

def xy(path):
    X, y, feats, _ = load(path, True)
    return X[:, [feats.index(f) for f in FEATS]], y

def fit(X, y):
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0)).fit(X, y)

Xc, yc = xy(OUT / "library_corpus.csv"); Xp, yp = xy(OUT / "library_real.csv"); Xs, ys = xy(OUT / "library_synth2.csv")
res = dict(n_corpus=int(len(yc)), n_packs=int(len(yp)), n_synth2=int(len(ys)), features=FEATS)
classes_c = set(yc)
mask = np.array([c in classes_c for c in yp])
m = fit(Xc, yc); res["corpus_to_packs"] = round(100 * float((m.predict(Xp[mask]) == yp[mask]).mean()))
res["corpus_to_packs_jobs"] = sorted(classes_c)
Xa = np.vstack([Xs, Xp, Xc]); ya = np.concatenate([ys, yp, yc]); dom = np.array(["synth2"] * len(ys) + ["packs"] * len(yp) + ["corpus"] * len(yc))
cv = StratifiedKFold(5, shuffle=True, random_state=0)
pred = cross_val_predict(make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)), Xa, ya, cv=cv)
for d in ("synth2", "packs", "corpus"):
    res[f"all_on_{d}"] = round(100 * float((pred[dom == d] == ya[dom == d]).mean()))
res["all_on_packs_recall"] = {c: round(float(((pred == c) & (ya == c) & (dom == "packs")).sum() / max(((ya == c) & (dom == "packs")).sum(), 1)), 2) for c in sorted(set(ya))}
old = json.load(open(OUT / "classifier_union.json"))["by_domain"]["real"]["acc"]
res["previous_on_packs"] = round(100 * old)
better = res["all_on_packs"] >= res["previous_on_packs"]
if better:
    full = fit(Xa, ya); sc, lr = full.named_steps["standardscaler"], full.named_steps["logisticregression"]
    model = dict(features=FEATS, mean=sc.mean_.round(6).tolist(), scale=sc.scale_.round(6).tolist(), weights=lr.coef_.round(6).tolist(), bias=lr.intercept_.round(6).tolist(), classes=list(lr.classes_))
    json.dump(dict(model=model, trained_on=dict(synth2=int(len(ys)), packs=int(len(yp)), corpus=int(len(yc))), results=res), open(OUT / "classifier_union3.json", "w"), indent=1)
    json.dump(model, open("/home/user/anthonybecker.me/research/sound-function/meter/model.json", "w"), indent=1)
    res["note"] = "So the meter now carries the model trained on all three. It is no worse on the packs. It has seen real hard techno kicks."
else:
    res["note"] = "Adding the corpus hits did not help on the packs. The meter keeps the part two model. The corpus hits stay in the repository for the next attempt."
res["meter_updated"] = bool(better)
json.dump(res, open(ROOT / "retrain.json", "w"), indent=1); print(json.dumps(res, indent=1))
