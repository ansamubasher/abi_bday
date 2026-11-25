import * as Phaser from "phaser";
import { GameScene } from "./GameScene";
import type { Save } from "./state";

export function createGame(parent: HTMLElement, save: Save) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: "#05070d",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 1800 }, debug: false } },
    render: { antialias: true, pixelArt: false, powerPreference: "high-performance" },
    audio: { noAudio: true }, // we use our own WebAudio engine
    banner: false,
  });
  game.scene.add("Game", GameScene, true, { save });
  return game;
}
