const funnyAdjectives = [
    'Zany', 'Goofy', 'Wobbly', 'Fluffy', 'Chubby', 'Silly', 'Giggly', 'Sneaky', 'Funky', 'Clumsy',
    'Spunky', 'Dorky', 'Wacky', 'Cheeky', 'Derpy', 'Sassy', 'Hyper', 'Grumpy', 'Lazy', 'Dizzy',
    'Loony', 'Confused', 'Bouncing', 'Dancing', 'Glitchy', 'Hungry', 'Sleepy', 'Naughty', 'Cranky', 'Stubborn',
    'Sparkling', 'Cosmic', 'Turbo', 'Psychedelic', 'Giggling', 'Crafty', 'Jolly', 'Wonky', 'Quirky',
    'Frantic', 'Moody', 'Snarky', 'Rowdy', 'Sizzling', 'Bouncy', 'Sloppy', 'Floppy', 'Twitchy', 'Googley',
    'Cheesy', 'Puzzled', 'Dazed', 'Salty', 'Spicy', 'Chilled', 'Hyperactive', 'Grinning', 'Smug', 'Weird',
    'Wiggly'
];

const funnyNouns = [
    'Sloth', 'Panda', 'Koala', 'Otter', 'Hedgehog', 'Penguin', 'Badger', 'Raccoon', 'Chameleon', 'Gecko',
    'Platypus', 'Wombat', 'Llama', 'Alpaca', 'Capybara', 'Meerkat', 'Squirrel', 'Hamster', 'Dodo', 'Flamingo',
    'Ostrich', 'Puffin', 'Ferret', 'Walrus', 'Pug', 'Corgi', 'Chinchilla', 'Axolotl', 'Blobfish', 'Octopus',
    'Doodler', 'Scribbler', 'Potato', 'Nugget', 'Muffin', 'Waffle', 'Goblin', 'Gremlin', 'Yeti', 'Taco',
    'Banana', 'Pickle', 'Avocado', 'Marshmallow', 'Cupcake', 'Donut', 'Pancake', 'Noodle', 'Dumpling',
    'Quokka', 'Manatee', 'Narwhal', 'Jellyfish', 'Beaver', 'Chipmunk', 'Lemur', 'Pufferfish', 'Gopher', 'Sausage',
    'Toast'
];

export function generateUsername(): string {
    const adj = funnyAdjectives[Math.floor(Math.random() * funnyAdjectives.length)];
    const noun = funnyNouns[Math.floor(Math.random() * funnyNouns.length)];
    return `${adj} ${noun}`;
}

export function getStoredUsername(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('drawny_username');
}

export function storeUsername(username: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('drawny_username', username);
}

export function getOrInitializeUsername(): string {
    let name = getStoredUsername();
    if (!name) {
        name = generateUsername();
        storeUsername(name);
    }
    return name;
}

export function rerollUsername(): string {
    const name = generateUsername();
    storeUsername(name);
    return name;
}
