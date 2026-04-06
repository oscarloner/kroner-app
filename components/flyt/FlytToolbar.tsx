"use client";

import { useState } from "react";
import styles from "./flyt.module.css";

export function FlytToolbar({
  onAddSource,
  onAddGroup,
  onImport,
  onReset
}: {
  onAddSource: (label: string) => void;
  onAddGroup: (label: string) => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const [sourcePrompt, setSourcePrompt] = useState(false);
  const [groupPrompt, setGroupPrompt] = useState(false);
  const [inputVal, setInputVal] = useState("");

  function submitSource() {
    if (inputVal.trim()) onAddSource(inputVal.trim());
    setSourcePrompt(false);
    setInputVal("");
  }

  function submitGroup() {
    if (inputVal.trim()) onAddGroup(inputVal.trim());
    setGroupPrompt(false);
    setInputVal("");
  }

  function handleKeyDown(e: React.KeyboardEvent, submit: () => void) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") { setSourcePrompt(false); setGroupPrompt(false); setInputVal(""); }
  }

  return (
    <div className={styles.toolbar}>
      {sourcePrompt ? (
        <div className={styles.toolbarPrompt}>
          <input
            className={styles.toolbarInput}
            autoFocus
            placeholder="Navn på kilde..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, submitSource)}
          />
          <button className={styles.toolbarConfirm} onClick={submitSource}>OK</button>
          <button className={styles.toolbarCancel} onClick={() => { setSourcePrompt(false); setInputVal(""); }}>✕</button>
        </div>
      ) : groupPrompt ? (
        <div className={styles.toolbarPrompt}>
          <input
            className={styles.toolbarInput}
            autoFocus
            placeholder="Navn på gruppe..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, submitGroup)}
          />
          <button className={styles.toolbarConfirm} onClick={submitGroup}>OK</button>
          <button className={styles.toolbarCancel} onClick={() => { setGroupPrompt(false); setInputVal(""); }}>✕</button>
        </div>
      ) : (
        <>
          <button className={styles.toolbarBtn} onClick={() => setSourcePrompt(true)}>
            + Kilde
          </button>
          <button className={styles.toolbarBtn} onClick={() => setGroupPrompt(true)}>
            + Gruppe
          </button>
          <button className={styles.toolbarBtn} onClick={onImport}>
            Importer
          </button>
          <button
            className={styles.toolbarBtnDanger}
            onClick={() => {
              if (confirm("Tøm canvas? Dette kan ikke angres.")) onReset();
            }}
          >
            Tilbakestill
          </button>
        </>
      )}
    </div>
  );
}
