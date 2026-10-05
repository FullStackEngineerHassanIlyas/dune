// Smoke scenes of the phase 3 campaign stream: every campaign screen through ?scene=menu&intro=0&screen=… with the
// house, mission and (for the results) stage from the address; results without a saved one use a sample.
const at = (screen, rest = '', settleMs = 1500) => ({ query: `scene=menu&intro=0&seed=5&quality=low&backdrop=planet&screen=${screen}${rest}`, settleMs });

export default {
  'campaign-hub': at('campaign'),
  'campaign-house': at('campaign-house'),
  'campaign-join': at('campaign-join', '&house=ordos', 2500),
  'campaign-briefing': at('campaign-briefing', '&house=atreides&mission=3', 2500),
  'campaign-region': at('campaign-region', '&house=harkonnen&mission=5', 3500),
  'campaign-victory': at('campaign-results', '&house=ordos&mission=2', 1200),
  'campaign-win': at('campaign-results', '&house=atreides&mission=4&stage=mentat', 3000),
  'campaign-score': at('campaign-results', '&house=harkonnen&mission=6&stage=score', 4500),
  'campaign-password-reveal': at('campaign-results', '&house=ordos&mission=5&stage=password'),
  'campaign-password': at('campaign-password'),
  'campaign-defeat': at('campaign-defeat', '&house=harkonnen&mission=3&won=0', 2500),
  'campaign-ending': at('campaign-ending', '&house=atreides&mission=9', 2500),
};
