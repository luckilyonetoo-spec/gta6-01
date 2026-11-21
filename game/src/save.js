// save.js — Solmar Bay's save file: cash, story progress, the player's place in the
// city and his health, kept in localStorage. A save from a newer shape is refused
// rather than misread.

SB.saveGame = function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.money,
      missionIndex: state.missions.index,
      missionStep: state.missions.step,
      storyDone: state.missions.done,
      player: { x: state.player.x, z: state.player.z, health: state.player.health },
      timeMinutes: state.timeMinutes,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SB.GAME.saveKey, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
};

SB.loadGame = function loadGame() {
  try {
    const raw = window.localStorage.getItem(SB.GAME.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    if (!data.player || typeof data.player.x !== 'number' || typeof data.player.z !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
};

SB.hasSave = function hasSave() {
  return SB.loadGame() !== null;
};

SB.clearSave = function clearSave() {
  try {
    window.localStorage.removeItem(SB.GAME.saveKey);
  } catch (e) { /* no save to clear */ }
};
