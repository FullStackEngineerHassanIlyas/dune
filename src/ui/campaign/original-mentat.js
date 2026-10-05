// The briefing's original Mentat (original-mentat-art.js), for mentatStage: the portrait's markup and the face's
// rig of a house's Mentat from the player's own Dune II PC files, when "Original pictures" is on and
// loadOriginalPictures() (original-pictures.js) has made them; null otherwise, and the stage keeps this game's
// painting. Take the rig only with the figure: it is drawn in the figure's frame, not the painting's.
import { currentPictures } from './original-pictures.js';

/** Markup for the portrait (in place of portraits.js mentatSvg(house): the same HTML contract), or null. */
export function originalMentatFigure(house, pictures = currentPictures()) {
  return pictures?.mentats?.[house]?.figure ?? null;
}

/** The face engine's rig (format v1) for that figure — his mouth frames, his shut eyes — a fresh copy, or null. */
export function originalMentatRig(house, pictures = currentPictures()) {
  const art = pictures?.mentats?.[house];
  return art?.figure && art.rig ? structuredClone(art.rig) : null;
}
