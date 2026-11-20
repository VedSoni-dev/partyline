// The built-in decks: used when the AI is off, slow or unreachable, and to top up an AI batch. All written for Partyline.

export const COMEBACK: string[] = [
  "The worst thing to hear from your pilot",
  "A terrible name for a retirement home",
  "What your houseplants say about you when you leave",
  "The real reason the dinosaurs went extinct",
  "A rejected flavour of toothpaste",
  "The worst thing to find in a fortune cookie",
  "What the Mona Lisa is actually smiling about",
  "A bad name for a boat",
  "The first rule of a very bad book club",
  "What a GPS says when it gives up",
  "A terrible thing to yell at a wedding",
  "The worst possible superhero power",
  "What your dog is really thinking during a bath",
  "A product that should never be voice-activated",
  "The one thing you shouldn't say on a first date",
  "A bad slogan for a dentist",
  "What aliens would find most confusing about humans",
  "A rejected Olympic sport",
  "The worst thing to have in your search history when you lend someone your laptop",
  "A terrible name for a perfume",
  "What a cat would put on its resume",
  "The worst text to get from your landlord",
  "A bad thing to name your Wi-Fi",
  "What really happens at a squirrel's birthday party",
  "The secret ingredient in grandma's cooking that nobody should know",
  "A terrible theme for a children's birthday party",
  "The worst possible fortune from a magic 8-ball",
  "What your fridge says about you behind your back",
  "A new law that would make everyone instantly angry",
  "The weirdest thing to bring to a job interview",
  "A bad name for a gym",
  "What the moon does when nobody is looking",
  "The least helpful thing a lifeguard could say",
  "A reality show that would get cancelled in one episode",
  "What a pigeon is planning",
  "The worst way to announce a pregnancy",
  "An app that nobody asked for",
  "What your sleep paralysis demon does on its day off",
  "A terrible motto for a hospital",
  "The worst flavour of ice cream",
  "Something you should never say to a horse",
  "The most useless kitchen gadget ever invented",
  "A bad name for a pet goldfish",
  "What a ghost complains about",
  "A rejected name for the Internet",
  "The worst thing to hear during a massage",
  "What the waiter is really writing on that notepad",
  "A strange thing to keep in your glovebox",
  "The worst way to end a phone call",
  "A holiday that should exist but doesn't",
];

/** Facts with a blank. Each truth checked; short so lies can sit next to it. */
export const FAKEOUT: { fact: string; truth: string; also?: string[] }[] = [
  { fact: "A group of flamingos is called a _____.", truth: "flamboyance" },
  { fact: "Wombats produce poop shaped like _____.", truth: "cubes", also: ["cube", "squares", "dice"] },
  { fact: "The national animal of Scotland is the _____.", truth: "unicorn" },
  { fact: "An octopus has _____ hearts.", truth: "three", also: ["3"] },
  { fact: "The dot over a lowercase i is called a _____.", truth: "tittle" },
  { fact: "A group of crows is called a _____.", truth: "murder" },
  { fact: "Bananas are slightly _____.", truth: "radioactive" },
  { fact: "The man who designed the Pringles can had some of his ashes buried in a _____.", truth: "Pringles can", also: ["pringle can", "pringles tube"] },
  { fact: "Sea otters hold _____ while they sleep so they don't drift apart.", truth: "hands", also: ["paws"] },
  { fact: "The plastic tip at the end of a shoelace is called an _____.", truth: "aglet" },
  { fact: "In Switzerland it's illegal to own just one _____.", truth: "guinea pig", also: ["guinea pigs"] },
  { fact: "The first item ever sold on eBay was a broken _____.", truth: "laser pointer" },
  { fact: "A baby puffin is called a _____.", truth: "puffling" },
  { fact: "Before video games, Nintendo made _____.", truth: "playing cards", also: ["cards"] },
  { fact: "Google's original name was _____.", truth: "BackRub" },
  { fact: "The Eiffel Tower gets about 15 cm taller in the _____.", truth: "summer" },
  { fact: "A group of owls is called a _____.", truth: "parliament" },
  { fact: "On Venus, a day is longer than a _____.", truth: "year" },
  { fact: "A shrimp's heart is in its _____.", truth: "head" },
  { fact: "In the 1830s, ketchup was sold as _____.", truth: "medicine" },
  { fact: "Bubble wrap was first invented to be used as _____.", truth: "wallpaper" },
  { fact: "The microwave oven was invented after a melted _____ was found in an engineer's pocket.", truth: "chocolate bar", also: ["chocolate", "candy bar"] },
  { fact: "Play-Doh was first sold as a _____ cleaner.", truth: "wallpaper" },
  { fact: "A group of pugs is called a _____.", truth: "grumble" },
  { fact: "Maine is the only US state whose name has just one _____.", truth: "syllable" },
  { fact: "Abraham Lincoln is in the National Hall of Fame for _____.", truth: "wrestling" },
  { fact: "A pineapple plant takes about _____ years to grow one pineapple.", truth: "two", also: ["2"] },
  { fact: "A group of ferrets is called a _____.", truth: "business" },
];

export const SKETCHY: string[] = [
  "a nervous hot dog at a job interview",
  "the moon taking a selfie",
  "a cactus that wants a hug",
  "a haunted toaster",
  "a snail winning a race",
  "a dragon doing taxes",
  "a sad cloud at a pool party",
  "the last slice of pizza",
  "a cat running a business meeting",
  "a volcano with stage fright",
  "a sandwich falling in love",
  "a penguin on vacation",
  "a very confident potato",
  "a ghost doing laundry",
  "a dog who got a promotion",
  "a broccoli bodybuilder",
  "a shark afraid of water",
  "a robot learning to dance",
  "an egg that just hatched a plan",
  "the Wi-Fi going down",
  "a pigeon stealing fries",
  "a tired superhero",
  "a banana in disguise",
  "a lighthouse that needs glasses",
  "a fish riding a bicycle",
  "a tornado at a tea party",
  "a giraffe in an elevator",
  "the sun on a Monday",
  "a cupcake with a secret",
  "an octopus doing the dishes",
  "a smug bowl of soup",
  "a skeleton at the gym",
  "a frog king without a crown",
  "a houseplant on a road trip",
  "a mushroom party",
  "a worried umbrella",
  "a dinosaur at the dentist",
  "a burrito's wedding",
  "a sloth delivering mail",
  "an alarm clock with regrets",
];

export function shuffle<T>(a: readonly T[], rand = Math.random): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return out;
}
/** n items from a deck, skipping ones already used this session. */
export function draw<T>(deck: readonly T[], n: number, used: Set<string>, key: (t: T) => string): T[] {
  const fresh = shuffle(deck.filter((t) => !used.has(key(t))));
  const pick = (fresh.length >= n ? fresh : [...fresh, ...shuffle(deck)]).slice(0, n);
  for (const t of pick) used.add(key(t));
  return pick;
}

/** Bot fallbacks when the AI is off. */
export const BOT_ANSWERS = ["a sock full of pudding", "my therapist", "absolutely nothing, as usual", "three raccoons in a coat", "the Wi-Fi password", "a strongly worded email", "free samples", "my mom's opinion", "a haunted spreadsheet", "the sound a goose makes"];
export const BOT_LIES = ["spoon", "Gerald", "jazz", "the Netherlands", "cheese", "seven", "trombone", "pancakes", "moustache", "a cloud"];
export const BOT_TITLES = ["a sad potato at prom", "my landlord on vacation", "a frog doing taxes", "grandpa on a jet ski", "the sun with a hangover", "a confused lamp", "a duck in witness protection", "a very tired pancake"];
