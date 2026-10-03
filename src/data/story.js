// Every word of the campaign (spec §7 "newly written text", §12; contract C4 of the phase 3 plan): the house
// pages and the question before house select, the Mentats' briefing, advice, win and loss lines for the nine
// Sega missions of each house, their last words after mission 9, a caption per territory-map step and the
// credits roll. The missions follow the Sega mission table and tech ladder (phase 3 research §6; topics §4):
// each briefing names exactly the enemies of its mission and each piece of advice what the ladder adds.
// The Mentats speak in their own manner: Cyril fair, calm and approving; Radnor contemptuous, cruel and sly;
// Ammon mercantile, curt and scheming. All of it is written for this project; none of it is the original's.
// A line is at most 56 characters, plain ASCII, as the briefing types it two lines at a time.
import { HOUSES } from './houses.js';

export const MENTATS = {
  atreides: { name: 'Cyril' },
  harkonnen: { name: 'Radnor' },
  ordos: { name: 'Ammon' },
};

/** Three pages per house, as the Sega house select shows them: its tradition, its ruler, its homeworld. */
export const HOUSE_PAGES = {
  atreides: [
    ['House Atreides rules by trust, not by terror.',
      'Its people serve it because they believe in it.'],
    ['The Duke leads his soldiers from the front.',
      'He listens before he judges, and keeps his word.'],
    ['Its home is Caladan, a mild world of seas and fields,',
      'where farms and industry thrive side by side.'],
  ],
  harkonnen: [
    ['House Harkonnen takes what it wants.',
      'Mercy is a weakness we leave to lesser Houses.'],
    ['The Baron rewards cunning and punishes failure.',
      'Those who serve him well grow rich. The rest vanish.'],
    ['Our home is Giedi Prime, a dark world of iron,',
      'smoke and hunger, where only the strong survive.'],
  ],
  ordos: [
    ['The Ordos are a league of merchant families.',
      'We make nothing. We buy, we sell, we profit.',
      'What cannot be bought, we undermine.'],
    ['No single lord rules us. A council of the richest',
      'families decides, and every decision is a deal.'],
    ['Our home is a frozen world of ice and long nights.',
      'Its cold taught us patience, thrift and secrecy.'],
  ],
};

const QUESTIONS = {
  atreides: 'Will you stand with House Atreides?',
  harkonnen: 'Will you serve House Harkonnen?',
  ordos: 'Will you sign on with House Ordos?',
};
/** The yes-or-no question after a house's pages; null for a house the player cannot join. */
export const joinQuestion = (house) => (HOUSES[house]?.playable && QUESTIONS[house]) || null;

/** BRIEFINGS[house][mission - 1] = { briefing, advice, win, lose }, each an array of lines. */
export const BRIEFINGS = {
  atreides: [
    { // 1: store 1000 credits; Ordos patrols, no base
      briefing: [
        'Welcome to Arrakis, Commander. I am Cyril,',
        'Mentat of House Atreides. I will advise you here.',
        'The Emperor cares for one thing here: spice.',
        'His decree gives Arrakis to his best supplier.',
        'We begin with a modest task: harvest spice until',
        '1000 credits are held safely in our stores.',
        'Ordos patrols roam this basin. They have no base,',
        'but they will not leave our Harvester in peace.',
      ],
      advice: [
        'Lay concrete before anything else. Buildings set on',
        'bare rock start weakened.',
        'Then raise a Wind Trap for power, and after it a',
        'Spice Refinery. The Refinery brings its own Harvester.',
      ],
      win: [
        'Well done. Our stores are full and our people fed.',
        'The Duke will hear of this from me in person.',
      ],
      lose: [
        'The quota was not met. That is no disgrace.',
        'Rest, Commander. We will begin again together.',
      ],
    },
    { // 2: store 2700 credits or destroy the Ordos base
      briefing: [
        'Your first harvest has impressed the Duke.',
        'Now we move into richer ground, and a harder one.',
        'The Ordos have built a base nearby. Their merchants',
        'would rather buy this land than fight for it,',
        'but they will fight if they are pressed.',
        'Store 2700 credits of spice or, if you prefer the',
        'direct path, destroy the Ordos base outright.',
        'Either will satisfy the Duke.',
      ],
      advice: [
        'Only spice held in storage counts toward the quota.',
        'Build Spice Silos so that none of it goes to waste.',
        'A Radar Outpost lets you build a Barracks, and the',
        'Heavy Factory now turns out Trikes for scouting.',
      ],
      win: [
        'Excellent work. The Ordos have learned that House',
        'Atreides cannot be bought or bullied.',
      ],
      lose: [
        'The Ordos outlasted us this time. Do not despair.',
        'Study their defences before you return.',
      ],
    },
    { // 3: destroy the Harkonnen base; worms from here on
      briefing: [
        'The Harkonnen have arrived, as we knew they would.',
        'They take what they want and burn what they cannot.',
        'We cannot share this world with them.',
        'Find their base and destroy it. Every building',
        'of theirs must fall before the region is ours.',
        'Be watchful in the open sand. The great worms of',
        'Arrakis have been seen here, and they hunt by sound.',
      ],
      advice: [
        'Upgrade the Heavy Factory and it will build Quads.',
        'They are faster and tougher than Trikes.',
        'Keep your vehicles on rock when worms are near.',
      ],
      win: [
        'A fine victory. The Harkonnen have been taught',
        'that our patience is not weakness.',
      ],
      lose: [
        'The Harkonnen held. Their cruelty makes them',
        'stubborn defenders. Rebuild, and we shall try again.',
      ],
    },
    { // 4: the Harkonnen again; Sardaukar Troopers drop in
      briefing: [
        'The Harkonnen have returned with more troops,',
        'and they are raiding our Harvesters in the sand.',
        'Something stranger troubles me. Sardaukar troopers,',
        'the Emperor\'s own soldiers, have been seen here.',
        'They come by Carryall and strike without warning.',
        'Destroy the Harkonnen base, and be ready for',
        'whoever else drops out of the sky.',
      ],
      advice: [
        'The Heavy Factory can now be upgraded for Combat Tanks.',
        'One Combat Tank is worth several light vehicles.',
        'Walls will slow the raiders down, and a second',
        'Harvester will keep the credits coming.',
      ],
      win: [
        'The Harkonnen are beaten again. You have earned',
        'the trust of every soldier in this army.',
      ],
      lose: [
        'We could not break them. The fault is not yours;',
        'the Sardaukar were more than any of us expected.',
      ],
    },
    { // 5: the Ordos base; the Emperor is arming the rivals
      briefing: [
        'I have troubling news. The Sardaukar we met were no',
        'accident. The Emperor himself is arming our rivals.',
        'This contest is not as open as he claimed.',
        'The Ordos have profited most from his favour.',
        'They have built a strong base, and mean to use it.',
        'Destroy it, Commander. Let them find out what their',
        'bargain with the Emperor has bought them.',
      ],
      advice: [
        'A Hi-Tech Factory builds Carryalls. They lift',
        'Harvesters to the spice and back, saving time.',
        'Build a Repair Facility, and upgrade the Heavy',
        'Factory for Missile Tanks. They strike from range.',
      ],
      win: [
        'The Ordos base is gone, and their bargain with it.',
        'You have done the Duke a great service.',
      ],
      lose: [
        'The Ordos held, with the Emperor\'s help. We are not',
        'finished. Regroup, and we will strike again.',
      ],
    },
    { // 6: the Harkonnen base; hold while attacking
      briefing: [
        'The Harkonnen are desperate, and desperate men',
        'strike hardest. They will attack while we attack.',
        'We must hold our ground and push forward at once.',
        'Their base lies across the open sand. Destroy it.',
        'Guard our own walls as well: the Emperor\'s',
        'Sardaukar may yet return to aid them.',
      ],
      advice: [
        'Upgrade the Construction Yard for Rocket Turrets.',
        'They guard the base while your army is away.',
        'A Starport sells vehicles from off-world. Its',
        'prices change, so buy when they are low.',
        'Siege Tanks are now ready at the Heavy Factory.',
      ],
      win: [
        'The Harkonnen are scattered. You held the line and',
        'struck at the same time. That is a rare skill.',
      ],
      lose: [
        'We were stretched too thin, defending and attacking',
        'at once. Strengthen the base before you go again.',
      ],
    },
    { // 7: two Ordos bases
      briefing: [
        'A new danger, Commander. The Ordos have built',
        'not one base in this region but two.',
        'Beware their Deviators: they can turn our own',
        'tanks against us for a time.',
        'Destroy both bases before they grow any stronger.',
        'The Sardaukar could appear at any time, so keep',
        'a reserve at home.',
      ],
      advice: [
        'Our engineers have finished the Sonic Tank. Its wave',
        'cuts through anything in its path, so keep our own',
        'units out of its line of fire.',
        'Upgrade the Hi-Tech Factory to build Ornithopters.',
      ],
      win: [
        'Both Ordos bases are rubble. The Duke sends his',
        'thanks, and so do I.',
      ],
      lose: [
        'Two bases proved too much this time. Strike at one',
        'first, then turn on the other.',
      ],
    },
    { // 8: the Ordos and the Harkonnen, one base each
      briefing: [
        'The Ordos and the Harkonnen have set aside their',
        'quarrels and joined against us. One base each lies',
        'in this region, and both must be destroyed.',
        'I suspect the Emperor arranged this alliance.',
        'His Sardaukar will be watching for their chance.',
        'This is the battle that decides Arrakis, Commander.',
        'Fight it as you have fought every other: well.',
      ],
      advice: [
        'You may now build a Palace. From it you can call the',
        'Fremen, the desert\'s own warriors. They cost nothing',
        'and come again once the Palace has recovered.',
        'Remember that a Palace needs a Starport first.',
      ],
      win: [
        'Both rival Houses are broken. Only the Emperor',
        'stands between House Atreides and Arrakis.',
      ],
      lose: [
        'Two Houses at once is a heavy burden. Rebuild,',
        'and let the Fremen strike while our tanks advance.',
      ],
    },
    { // 9: two Sardaukar bases
      briefing: [
        'The mask is off. The Emperor has landed his own',
        'Sardaukar on Arrakis to take the planet himself.',
        'Two Sardaukar bases stand before us. They are the',
        'finest soldiers in the Empire, and they know it.',
        'Destroy both bases and the contest is over.',
        'Whatever happens, Commander, I am proud to have',
        'served beside you.',
      ],
      advice: [
        'If the Sardaukar hold a Palace, its Death Hand will',
        'fall on us. Do not crowd your buildings together.',
        'Watch every flank: they favour sudden raids on',
        'Harvesters and lightly guarded corners.',
      ],
      win: [
        'It is done. The Sardaukar are defeated and the',
        'Emperor has nowhere left to hide.',
      ],
      lose: [
        'The Sardaukar held. Rest, gather our strength,',
        'and we will end this on the next attempt.',
      ],
    },
  ],

  harkonnen: [
    { // 1: store 1000 credits; Atreides soldiers, no base
      briefing: [
        'So, you are the new commander. I am Radnor,',
        'Mentat to the Baron. Try not to bore me.',
        'The Emperor is greedy, and Arrakis is his bait.',
        'Feed him enough spice and he will hand it to us.',
        'Your first task is beneath a true Harkonnen:',
        'harvest until 1000 credits sit in our stores.',
        'Some Atreides soldiers wander this region. Kill',
        'them if they get in the way. Kill them if they don\'t.',
      ],
      advice: [
        'Even a child knows to lay concrete first.',
        'Then a Wind Trap, then a Spice Refinery. The',
        'Refinery comes with a Harvester. Do not lose it;',
        'the Baron hates waste, and those who cause it.',
      ],
      win: [
        'Adequate. The Baron has been told you can count.',
        'Do not expect praise for doing the obvious.',
      ],
      lose: [
        'You failed to gather a little sand. How touching.',
        'Try again, before the Baron learns your name.',
      ],
    },
    { // 2: store 2700 credits or wipe out the Atreides base
      briefing: [
        'The Atreides have built a base here. Noble fools;',
        'they think the Emperor\'s contest is about honour.',
        'Store 2700 credits of spice, or wipe their base',
        'from the sand. The spice is what the Baron wants.',
        'Crushing the Atreides is simply a pleasure.',
        'I leave the choice to you. Choose wisely, or at',
        'least choose quickly.',
      ],
      advice: [
        'Spice only counts once it is stored. Build Silos.',
        'A Radar Outpost will let you build a WOR, which',
        'trains Troopers. Put them where the Atreides attack.',
      ],
      win: [
        'The Baron is satisfied, for now. Savour it;',
        'his satisfaction never lasts.',
      ],
      lose: [
        'Beaten by the Atreides. They will be insufferable.',
        'Go back, and this time make them suffer instead.',
      ],
    },
    { // 3: destroy the Ordos base; the vehicle factory arrives
      briefing: [
        'The Ordos have come, smiling and counting coin.',
        'Merchants. They would sell their own mothers for a',
        'good price, and they think we can be bought too.',
        'Show them otherwise. Find their base and destroy',
        'it. Leave nothing standing.',
        'Mind the open sand. Worms roam here, and they do not',
        'care whose army they swallow.',
      ],
      advice: [
        'At last you may build a Heavy Factory. It makes',
        'Quads, and Quads make the Ordos weep.',
        'Keep your vehicles on rock when the worms stir.',
      ],
      win: [
        'The Ordos base is ash. Their accountants will',
        'need a new column for losses.',
      ],
      lose: [
        'Outwitted by shopkeepers. The Baron is not amused.',
        'Try again, and leave fewer of them breathing.',
      ],
    },
    { // 4: the Ordos again; Sardaukar Troopers drop in
      briefing: [
        'The Ordos have rebuilt, and they hire well.',
        'Their raiders have been picking at our Harvesters.',
        'There is more. Sardaukar troopers have been seen,',
        'dropped in by Carryall. The Emperor\'s own dogs.',
        'Whose leash they wear, I have not yet learned.',
        'Destroy the Ordos base. If the Sardaukar get in',
        'your way, destroy them too. Quietly, if you can.',
      ],
      advice: [
        'Upgrade the Heavy Factory for Combat Tanks, and',
        'the WOR for Trooper squads.',
        'Walls will keep raiders away from your Refinery.',
      ],
      win: [
        'The Ordos are bleeding money and men. Good.',
        'The Baron enjoyed the report. So did I.',
      ],
      lose: [
        'The Ordos bought better luck than you had.',
        'Rebuild, and spend our soldiers more wisely.',
      ],
    },
    { // 5: the Atreides base; the Emperor is arming them
      briefing: [
        'Interesting. The Emperor has been feeding the',
        'Atreides weapons while preaching fair play.',
        'Even I admire the hypocrisy.',
        'His Sardaukar may drop in again to help them.',
        'No matter. The Atreides have built a fine base.',
        'Burn it, and destroy anyone who tries to save it.',
        'The Baron does not forgive those who arm his foes.',
      ],
      advice: [
        'Build a Hi-Tech Factory and it will give you Carryalls',
        'to carry Harvesters to the spice faster.',
        'Upgrade the Heavy Factory and it builds Missile Tanks.',
        'Use them. A Repair Facility will save you a few tanks.',
      ],
      win: [
        'The Atreides base burns. A lovely sight.',
        'The Baron has ordered the recording kept.',
      ],
      lose: [
        'The Atreides beat you. The Atreides. Think on that.',
        'Then go back and wipe the smile from their faces.',
      ],
    },
    { // 6: two Ordos bases
      briefing: [
        'The Ordos have two bases here, and they are spending',
        'freely. Every attack they make costs them a fortune.',
        'Let them spend. We will attack while they do.',
        'Destroy both bases. Keep our own walls manned; the',
        'Ordos like to strike where nobody is looking.',
        'And the Sardaukar still circle, like vultures.',
      ],
      advice: [
        'Rocket Turrets come with a Construction Yard upgrade.',
        'The Starport sells vehicles cheaply, when the price',
        'is right. Siege Tanks are ready as well.',
      ],
      win: [
        'Two Ordos bases gone. They will be checking their',
        'ledgers for years.',
      ],
      lose: [
        'You let the Ordos sneak in behind you. Again.',
        'Guard the base this time, and then go back.',
      ],
    },
    { // 7: two Atreides bases
      briefing: [
        'The Atreides have dug in with two bases. Their',
        'Sonic Tanks are a nuisance; their pride is worse.',
        'Destroy both bases. All of them. Every building.',
        'I want the Duke to hear of it and weep.',
        'The Sardaukar may yet drop in on either side, so',
        'keep an eye on the sky.',
      ],
      advice: [
        'Our finest toy is ready: the Devastator. It is slow,',
        'but nothing stands against it for long.',
        'If it is about to fall, set off its self-destruct',
        'and take the enemy with it.',
      ],
      win: [
        'Two Atreides bases, flattened. The Baron laughed',
        'aloud. I have never heard him laugh before.',
      ],
      lose: [
        'Even with a Devastator, you lost. Remarkable.',
        'Go back. Try aiming it at the enemy this time.',
      ],
    },
    { // 8: the Atreides and the Ordos, one base each
      briefing: [
        'Our enemies have finally done something clever.',
        'The Atreides and the Ordos have joined forces,',
        'each with a base here. The Emperor\'s doing, again;',
        'his Sardaukar will not be far away.',
        'Destroy them both, and Arrakis is all but ours.',
        'Two Houses, one army, and twice the corpses.',
        'I expect you to enjoy this one.',
      ],
      advice: [
        'You may build a Palace, once you have a Starport.',
        'From it you may launch a Death Hand missile.',
        'It is not accurate, but it is free, and it reloads.',
        'Aim at the middle of their base and enjoy the view.',
      ],
      win: [
        'Both Houses lie broken. The Baron is almost',
        'pleased. Almost is the best you will ever get.',
      ],
      lose: [
        'Two Houses at once was too much for you, it seems.',
        'Use the Death Hand properly next time.',
      ],
    },
    { // 9: two Sardaukar bases
      briefing: [
        'Now we come to it. The Emperor has dropped his',
        'pretence and sent his Sardaukar to take Arrakis.',
        'Two of their bases stand between us and the throne.',
        'Destroy them, and the Emperor is at our mercy.',
        'And mercy is not something the Baron keeps.',
        'Do not fail me now. I have grown used to you.',
      ],
      advice: [
        'A Sardaukar Palace would mean a Death Hand for us.',
        'Spread your buildings out; do not make it easy.',
        'They raid from the flanks. Leave guards at home.',
      ],
      win: [
        'The Sardaukar are dead and the Emperor is ours.',
        'I may even say it: well done.',
      ],
      lose: [
        'The Sardaukar crushed you. The Baron is drafting',
        'your obituary. Prove him wrong; go back.',
      ],
    },
  ],

  ordos: [
    { // 1: store 1000 credits; Harkonnen patrols, no base
      briefing: [
        'I am Ammon, Mentat to the Ordos Council.',
        'I will be brief. Time is money.',
        'The Emperor is selling Arrakis. The price is spice.',
        'We intend to be the highest bidder.',
        'Your first contract: 1000 credits in our stores.',
        'Harkonnen thugs prowl this region. No base, only',
        'brutes. Avoid them where you can, kill them if not.',
        'Losses come out of your share.',
      ],
      advice: [
        'Concrete first. It protects what we pay for.',
        'Next a Wind Trap, and a Spice Refinery after it.',
        'The Refinery includes a Harvester. Keep it working.',
      ],
      win: [
        'Contract fulfilled. The Council has entered your',
        'name in the ledger, on the right side.',
      ],
      lose: [
        'Quota missed. An unprofitable day.',
        'You may try again. The Council is patient, once.',
      ],
    },
    { // 2: store 2700 credits or remove the Harkonnen base
      briefing: [
        'A new site, richer and less quiet.',
        'The Harkonnen have a base here. They will attack;',
        'it is the only thing they know how to do.',
        'Store 2700 credits, or remove the Harkonnen base.',
        'The first is cheaper. The second lasts longer.',
        'Your choice. Make it profitable.',
      ],
      advice: [
        'Spice in storage is what counts. Build Silos.',
        'A Barracks needs a Radar Outpost first. Its Infantry',
        'can take enemy buildings. A captured Silo is free.',
        'Raider Trikes are fast and cheap. Scout with them.',
      ],
      win: [
        'Profitable. The Harkonnen paid for their manners.',
        'Your commission has been approved.',
      ],
      lose: [
        'The Harkonnen outbid us with brute force.',
        'Reassess, reinvest, and return.',
      ],
    },
    { // 3: destroy the Atreides base; worms from here on
      briefing: [
        'The Atreides are here, talking of honour and duty.',
        'Honour does not appear on any balance sheet.',
        'Their base sits on spice we want. Destroy it.',
        'Worms are active in this area. A Harvester lost to',
        'a worm is a pure loss. Watch the sand.',
      ],
      advice: [
        'Upgrade the Heavy Factory to build Quads.',
        'Raiders scout; Quads fight. Do not confuse the two.',
        'Keep vehicles on rock when worms are close.',
      ],
      win: [
        'The Atreides base is liquidated. Excellent margins.',
        'The Council is pleased.',
      ],
      lose: [
        'Honour beat us. Embarrassing, and costly.',
        'Return with a better plan.',
      ],
    },
    { // 4: the Atreides again; Sardaukar Troopers drop in
      briefing: [
        'The Atreides have reinforced. Their raids on our',
        'Harvesters cost us. Costs must be cut.',
        'A complication: Sardaukar troopers have appeared,',
        'dropped in by Carryall. The Emperor is investing.',
        'In whom, I intend to find out.',
        'Destroy the Atreides base. Count the Sardaukar.',
      ],
      advice: [
        'Upgrade the Heavy Factory for Combat Tanks.',
        'Troopers can now be trained. Their rockets hurt tanks.',
        'Walls are cheap. Harvesters are not. Protect them.',
      ],
      win: [
        'Base destroyed. Losses acceptable. Good work.',
        'The Council has raised your allowance.',
      ],
      lose: [
        'A loss. The Sardaukar were not in the estimate.',
        'Revise the estimate, then return.',
      ],
    },
    { // 5: two Harkonnen bases; the Emperor is arming them
      briefing: [
        'I have traced the Sardaukar. The Emperor is',
        'supplying our rivals while claiming neutrality.',
        'Poor business practice. We will remember it.',
        'The Harkonnen have two bases here, both well armed.',
        'Destroy both. The Emperor\'s investment in the',
        'Harkonnen should show a total loss.',
      ],
      advice: [
        'A Hi-Tech Factory builds Carryalls. They ferry',
        'Harvesters and save time. Time is credits.',
        'A Repair Facility costs less than a new tank.',
        'Gun Turrets are cheap insurance for the base.',
      ],
      win: [
        'Both Harkonnen bases written off. Elegant work.',
        'The Emperor will feel this in his accounts.',
      ],
      lose: [
        'Two bases were more than our budget allowed.',
        'Take one, then the other. Return.',
      ],
    },
    { // 6: two Atreides bases
      briefing: [
        'Two Atreides bases ahead. They will attack us',
        'while we attack them. Defend and advance at once.',
        'Their soldiers are loyal. Loyalty cannot be bought,',
        'so it must be destroyed.',
        'Destroy both bases. The Sardaukar may intervene.',
      ],
      advice: [
        'A Construction Yard upgrade buys Rocket Turrets.',
        'The Starport is open. It sells Missile Tanks and',
        'more, and its prices move. Buy low.',
        'Trooper squads can now be trained as well.',
      ],
      win: [
        'Two bases closed down. Loyalty was a poor investment.',
        'Well managed.',
      ],
      lose: [
        'The Atreides held both bases. Their loyalty paid.',
        'Ours must pay better. Return.',
      ],
    },
    { // 7: two Harkonnen bases
      briefing: [
        'The Harkonnen have two bases again, and Devastators.',
        'Brute force. Very expensive brute force.',
        'Destroy both bases. The Sardaukar may drop in again,',
        'so do not leave the Refinery unguarded.',
        'This is the last step before the big contracts.',
      ],
      advice: [
        'The Deviator is ready. Its gas turns enemy units',
        'to our side for a time. Their best tank, our tank.',
        'Siege Tanks are now on sale, and the Hi-Tech',
        'Factory can be upgraded for Ornithopters.',
      ],
      win: [
        'Both Harkonnen bases cleared. Their Devastators',
        'made very good scrap.',
      ],
      lose: [
        'Harkonnen brute force won. Temporarily.',
        'Turn their tanks against them, then return.',
      ],
    },
    { // 8: the Atreides and the Harkonnen, one base each
      briefing: [
        'A merger, of sorts. The Atreides and the Harkonnen',
        'have joined against us. Each holds a base here.',
        'They despise each other. Their alliance will fail,',
        'but it need not last long to ruin us.',
        'Destroy both bases. The Emperor is behind this deal.',
        'Watch for his Sardaukar.',
      ],
      advice: [
        'You may now build a Palace, once a Starport stands.',
        'It trains a Saboteur at no cost. Send him into',
        'their base and he will bring it down from inside.',
        'The Palace makes another in time. Use them often.',
      ],
      win: [
        'Both rivals bankrupt. Only one shareholder remains:',
        'the Emperor.',
      ],
      lose: [
        'Two opponents at once. The numbers did not work.',
        'Send a Saboteur in first next time.',
      ],
    },
    { // 9: two Sardaukar bases
      briefing: [
        'Final accounts. The Emperor has sent his Sardaukar',
        'to seize Arrakis himself. Two bases, his best men.',
        'Destroy them, and the Emperor must deal with us.',
        'On our terms.',
        'Every credit the Council has spent comes down to',
        'this. Do not waste it.',
      ],
      advice: [
        'The Sardaukar may own a Palace, and so a Death Hand.',
        'Keep the base spread out.',
        'They will raid the flanks. Guard the Harvesters.',
      ],
      win: [
        'The Sardaukar are finished. The Emperor is ready',
        'to negotiate. I will handle the negotiations.',
      ],
      lose: [
        'The Sardaukar held. A costly failure.',
        'The Council will fund one more attempt.',
      ],
    },
  ],
};

/** The Mentat's last words after mission 9: what becomes of the Emperor, and of Arrakis. */
export const ENDINGS = {
  atreides: [
    'It is over, Commander. Arrakis is ours.',
    'The Emperor has given up his throne, and he will',
    'stand trial for the treachery he worked against us.',
    'The Duke will govern here with justice. The spice',
    'will flow, and those who harvest it will be paid.',
    'The Ordos and the Harkonnen are gone from this world.',
    'I take no joy in their fall, only in the peace.',
    'Thank you. It has been an honour to serve with you.',
  ],
  harkonnen: [
    'The Emperor is dead. He begged; it did not help him.',
    'The Baron rules Arrakis now, and soon the rest',
    'of the Empire will learn to kneel.',
    'Every grain of spice belongs to House Harkonnen.',
    'You have done well, Commander. Enjoy it. The Baron',
    'rewards success richly, and forgets it quickly.',
  ],
  ordos: [
    'Arrakis is ours, and so is the Emperor.',
    'He keeps his throne and his title. We keep him.',
    'Every order he gives will be one we have written.',
    'The spice flows through Ordos hands, at Ordos prices.',
    'The Council thanks you. Your share has been paid.',
  ],
};

/** A caption for each territory-map step: 0 before mission 1, n after mission n is won. As the atlas draws it,
 *  mission 1 takes no land and step 9 still leaves the Emperor his region (the ending takes it). */
export const MAP_CAPTIONS = {
  atreides: [
    'House Atreides sets foot on Arrakis.',
    'Our first harvest is in. The Ordos are watching.',
    'The Ordos give ground before us.',
    'The Harkonnen line begins to crack.',
    'The Harkonnen fall back, Sardaukar or no.',
    'The Ordos lose their richest fields.',
    'The Harkonnen are driven from their strongholds.',
    'Only scattered Ordos camps remain.',
    'Both rival Houses are broken.',
    'Only the Emperor\'s stronghold still defies the Duke.',
  ],
  harkonnen: [
    'House Harkonnen lands on Arrakis, hungry.',
    'The Atreides cower behind their honour.',
    'The open sand bows to the Harkonnen banner.',
    'The Ordos learn what their coin is worth.',
    'The Ordos bleed. The Sardaukar watch.',
    'The Atreides are trampled into the sand.',
    'Ordos land is ours. They may rent it back.',
    'Little is left of House Atreides.',
    'Two Houses broken. One remains: ours.',
    'Only the Emperor\'s fortress stands. Not for long.',
  ],
  ordos: [
    'House Ordos stakes its first claims.',
    'First profits secured. The Harkonnen are restless.',
    'Unclaimed sand registered to the Ordos. No charge.',
    'Atreides holdings pass into Ordos hands.',
    'The Atreides retreat. The Sardaukar take notes.',
    'Two Harkonnen bases written off.',
    'Atreides territory acquired at a fair price.',
    'The Harkonnen are nearly out of business.',
    'Both rivals are bankrupt.',
    'One holding left to acquire: the Emperor\'s own.',
  ],
};

/** The credits roll over the planet after mission 9: a heading and its lines. */
export const CREDITS = [
  { role: 'Dune II 3D', names: ['A non-commercial fan remake'] },
  { role: 'After', names: ["Westwood Studios' Dune: The Battle for Arrakis", 'for the Sega Mega Drive'] },
  { role: 'Code, models, music, sound and words', names: ['All made for this remake'] },
  { role: 'Voices', names: ['Rendered for this remake with the', 'Kokoro-82M text-to-speech model, Apache-2.0,', 'run through kokoro-onnx, MIT'] },
  { role: 'Sega soundtrack player', names: ['Plays the music from your own copy only', 'YM2612 core ported from ymfm by Aaron Giles,', 'BSD-3-Clause'] },
  { role: 'Graphics', names: ['three.js, MIT'] },
  { role: 'Rights', names: [
    'Dune: The Battle for Arrakis and Dune II belong',
    'to Electronic Arts. The Dune name belongs to',
    'Herbert Properties. This remake is not affiliated',
    'with or endorsed by either.',
  ] },
  { role: 'Thank you for playing', names: ['Arrakis will wait for your return'] },
];
