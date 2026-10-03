// The Sega-style opening before the title and the campaign's ending (spec §5.8). Until phase 3 builds them the
// title shows at once and the ending is skipped.
//   runIntro(ctx): ctx = { params, settings, app, backdrop, menu, music, startBackdrop(opts), debug }. Hides the
//     menu while it plays, calls ctx.startBackdrop() when the backdrop should run (the shell starts it afterwards
//     if the intro did not) and shows the menu when it is done, skipped or failed.
//   playEnding(ctx): ctx = { house, app, backdrop, menu, music }; resolves when the ending is over or skipped.
export async function runIntro() { return { played: false }; }

export async function playEnding() { return { played: false }; }
