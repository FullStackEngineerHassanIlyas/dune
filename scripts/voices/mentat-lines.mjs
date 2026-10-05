// Prints every Mentat clip of src/data/story.js as JSON for scripts/voices/mentat.py (src/audio/mentat-lines.js).
import * as story from '../../src/data/story.js';
import { mentatClips } from '../../src/audio/mentat-lines.js';

process.stdout.write(JSON.stringify(mentatClips(story)));
