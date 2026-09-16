export type Breed = {
  id: string;
  nameEn: string;
  nameSv: string;
};

/** Documented kennel-club breeds (FCI / AKC / SKK). Canonical English id + Swedish display name. */
export const BREEDS: Breed[] = [
  { id: "affenpinscher", nameEn: "Affenpinscher", nameSv: "Affenpinscher" },
  { id: "afghan-hound", nameEn: "Afghan Hound", nameSv: "Afghansk vinthund" },
  { id: "airedale-terrier", nameEn: "Airedale Terrier", nameSv: "Airedaleterrier" },
  { id: "akita", nameEn: "Akita", nameSv: "Akita" },
  { id: "alaskan-malamute", nameEn: "Alaskan Malamute", nameSv: "Alaskan malamute" },
  { id: "american-staffordshire-terrier", nameEn: "American Staffordshire Terrier", nameSv: "American staffordshire terrier" },
  { id: "australian-cattle-dog", nameEn: "Australian Cattle Dog", nameSv: "Australian cattle dog" },
  { id: "australian-shepherd", nameEn: "Australian Shepherd", nameSv: "Australian shepherd" },
  { id: "barbet", nameEn: "Barbet", nameSv: "Barbet" },
  { id: "basenji", nameEn: "Basenji", nameSv: "Basenji" },
  { id: "basset-hound", nameEn: "Basset Hound", nameSv: "Basset hound" },
  { id: "beagle", nameEn: "Beagle", nameSv: "Beagle" },
  { id: "bearded-collie", nameEn: "Bearded Collie", nameSv: "Bearded collie" },
  { id: "bedlington-terrier", nameEn: "Bedlington Terrier", nameSv: "Bedlingtonterrier" },
  { id: "belgian-malinois", nameEn: "Belgian Malinois", nameSv: "Malinois" },
  { id: "bernese-mountain-dog", nameEn: "Bernese Mountain Dog", nameSv: "Berner sennenhund" },
  { id: "bichon-frise", nameEn: "Bichon Frise", nameSv: "Bichon frisé" },
  { id: "black-russian-terrier", nameEn: "Black Russian Terrier", nameSv: "Svart rysk terrier" },
  { id: "bloodhound", nameEn: "Bloodhound", nameSv: "Blodhund" },
  { id: "border-collie", nameEn: "Border Collie", nameSv: "Border collie" },
  { id: "border-terrier", nameEn: "Border Terrier", nameSv: "Borderterrier" },
  { id: "borzoi", nameEn: "Borzoi", nameSv: "Rysk vinthund" },
  { id: "boston-terrier", nameEn: "Boston Terrier", nameSv: "Bostonterrier" },
  { id: "bouvier-des-flandres", nameEn: "Bouvier des Flandres", nameSv: "Bouvier des flandres" },
  { id: "boxer", nameEn: "Boxer", nameSv: "Boxer" },
  { id: "briard", nameEn: "Briard", nameSv: "Briard" },
  { id: "brittany", nameEn: "Brittany", nameSv: "Bretagne" },
  { id: "bull-terrier", nameEn: "Bull Terrier", nameSv: "Bullterrier" },
  { id: "bulldog", nameEn: "Bulldog", nameSv: "Engelsk bulldogg" },
  { id: "bullmastiff", nameEn: "Bullmastiff", nameSv: "Bullmastiff" },
  { id: "cairn-terrier", nameEn: "Cairn Terrier", nameSv: "Cairnterrier" },
  { id: "cane-corso", nameEn: "Cane Corso", nameSv: "Cane corso" },
  { id: "cavalier-king-charles-spaniel", nameEn: "Cavalier King Charles Spaniel", nameSv: "Cavalier king charles spaniel" },
  { id: "chesapeake-bay-retriever", nameEn: "Chesapeake Bay Retriever", nameSv: "Chesapeake bay retriever" },
  { id: "chihuahua", nameEn: "Chihuahua", nameSv: "Chihuahua" },
  { id: "chow-chow", nameEn: "Chow Chow", nameSv: "Chow chow" },
  { id: "clumber-spaniel", nameEn: "Clumber Spaniel", nameSv: "Clumberspaniel" },
  { id: "cocker-spaniel", nameEn: "Cocker Spaniel", nameSv: "Cocker spaniel" },
  { id: "collie", nameEn: "Collie", nameSv: "Collie" },
  { id: "dachshund", nameEn: "Dachshund", nameSv: "Tax" },
  { id: "dalmatian", nameEn: "Dalmatian", nameSv: "Dalmatiner" },
  { id: "dandie-dinmont-terrier", nameEn: "Dandie Dinmont Terrier", nameSv: "Dandie dinmont terrier" },
  { id: "doberman-pinscher", nameEn: "Doberman Pinscher", nameSv: "Dobermann" },
  { id: "dogo-argentino", nameEn: "Dogo Argentino", nameSv: "Dogo argentino" },
  { id: "english-setter", nameEn: "English Setter", nameSv: "Engelsk setter" },
  { id: "english-springer-spaniel", nameEn: "English Springer Spaniel", nameSv: "Engelsk springer spaniel" },
  { id: "field-spaniel", nameEn: "Field Spaniel", nameSv: "Field spaniel" },
  { id: "finnish-spitz", nameEn: "Finnish Spitz", nameSv: "Finsk spets" },
  { id: "flat-coated-retriever", nameEn: "Flat-Coated Retriever", nameSv: "Flatcoated retriever" },
  { id: "french-bulldog", nameEn: "French Bulldog", nameSv: "Fransk bulldogg" },
  { id: "german-shepherd", nameEn: "German Shepherd", nameSv: "Schäfer" },
  { id: "german-shorthaired-pointer", nameEn: "German Shorthaired Pointer", nameSv: "Korthårig vorsteh" },
  { id: "german-wirehaired-pointer", nameEn: "German Wirehaired Pointer", nameSv: "Strävhårig vorsteh" },
  { id: "giant-schnauzer", nameEn: "Giant Schnauzer", nameSv: "Riesenschnauzer" },
  { id: "golden-retriever", nameEn: "Golden Retriever", nameSv: "Golden retriever" },
  { id: "gordon-setter", nameEn: "Gordon Setter", nameSv: "Gordonsetter" },
  { id: "great-dane", nameEn: "Great Dane", nameSv: "Grand danois" },
  { id: "great-pyrenees", nameEn: "Great Pyrenees", nameSv: "Pyrenéerhund" },
  { id: "greyhound", nameEn: "Greyhound", nameSv: "Greyhound" },
  { id: "havanese", nameEn: "Havanese", nameSv: "Bichon havanais" },
  { id: "ibizan-hound", nameEn: "Ibizan Hound", nameSv: "Podenco ibicenco" },
  { id: "irish-setter", nameEn: "Irish Setter", nameSv: "Irländsk röd setter" },
  { id: "irish-terrier", nameEn: "Irish Terrier", nameSv: "Irländsk terrier" },
  { id: "irish-water-spaniel", nameEn: "Irish Water Spaniel", nameSv: "Irländsk vattenspaniel" },
  { id: "irish-wolfhound", nameEn: "Irish Wolfhound", nameSv: "Irländsk varghund" },
  { id: "italian-greyhound", nameEn: "Italian Greyhound", nameSv: "Italiensk vinthund" },
  { id: "japanese-chin", nameEn: "Japanese Chin", nameSv: "Japanese chin" },
  { id: "keeshond", nameEn: "Keeshond", nameSv: "Keeshond" },
  { id: "kerry-blue-terrier", nameEn: "Kerry Blue Terrier", nameSv: "Kerry blue terrier" },
  { id: "komondor", nameEn: "Komondor", nameSv: "Komondor" },
  { id: "kuvasz", nameEn: "Kuvasz", nameSv: "Kuvasz" },
  { id: "labrador-retriever", nameEn: "Labrador Retriever", nameSv: "Labrador retriever" },
  { id: "lagotto-romagnolo", nameEn: "Lagotto Romagnolo", nameSv: "Lagotto romagnolo" },
  { id: "lakeland-terrier", nameEn: "Lakeland Terrier", nameSv: "Lakelandterrier" },
  { id: "leonberger", nameEn: "Leonberger", nameSv: "Leonberger" },
  { id: "lhasa-apso", nameEn: "Lhasa Apso", nameSv: "Lhasa apso" },
  { id: "maltese", nameEn: "Maltese", nameSv: "Malteser" },
  { id: "manchester-terrier", nameEn: "Manchester Terrier", nameSv: "Manchesterterrier" },
  { id: "mastiff", nameEn: "Mastiff", nameSv: "Mastiff" },
  { id: "miniature-pinscher", nameEn: "Miniature Pinscher", nameSv: "Dvärgpinscher" },
  { id: "miniature-schnauzer", nameEn: "Miniature Schnauzer", nameSv: "Dvärgschnauzer" },
  { id: "newfoundland", nameEn: "Newfoundland", nameSv: "Newfoundlandshund" },
  { id: "norfolk-terrier", nameEn: "Norfolk Terrier", nameSv: "Norfolkterrier" },
  { id: "norwegian-elkhound", nameEn: "Norwegian Elkhound", nameSv: "Norsk älghund" },
  { id: "norwich-terrier", nameEn: "Norwich Terrier", nameSv: "Norwichterrier" },
  { id: "old-english-sheepdog", nameEn: "Old English Sheepdog", nameSv: "Old english sheepdog" },
  { id: "papillon", nameEn: "Papillon", nameSv: "Papillon" },
  { id: "pekingese", nameEn: "Pekingese", nameSv: "Pekingese" },
  { id: "pembroke-welsh-corgi", nameEn: "Pembroke Welsh Corgi", nameSv: "Welsh corgi pembroke" },
  { id: "pharaoh-hound", nameEn: "Pharaoh Hound", nameSv: "Faraohund" },
  { id: "pointer", nameEn: "Pointer", nameSv: "Pointer" },
  { id: "pomeranian", nameEn: "Pomeranian", nameSv: "Pomeranian" },
  { id: "poodle-miniature", nameEn: "Miniature Poodle", nameSv: "Dvärgpudel" },
  { id: "poodle-standard", nameEn: "Standard Poodle", nameSv: "Pudel" },
  { id: "poodle-toy", nameEn: "Toy Poodle", nameSv: "Toypudel" },
  { id: "portuguese-water-dog", nameEn: "Portuguese Water Dog", nameSv: "Portugisisk vattenhund" },
  { id: "pug", nameEn: "Pug", nameSv: "Mops" },
  { id: "puli", nameEn: "Puli", nameSv: "Puli" },
  { id: "rhodesian-ridgeback", nameEn: "Rhodesian Ridgeback", nameSv: "Rhodesian ridgeback" },
  { id: "rottweiler", nameEn: "Rottweiler", nameSv: "Rottweiler" },
  { id: "saint-bernard", nameEn: "Saint Bernard", nameSv: "Sankt bernhardshund" },
  { id: "saluki", nameEn: "Saluki", nameSv: "Saluki" },
  { id: "samoyed", nameEn: "Samoyed", nameSv: "Samojedhund" },
  { id: "schipperke", nameEn: "Schipperke", nameSv: "Schipperke" },
  { id: "scottish-terrier", nameEn: "Scottish Terrier", nameSv: "Skotsk terrier" },
  { id: "shetland-sheepdog", nameEn: "Shetland Sheepdog", nameSv: "Shetland sheepdog" },
  { id: "shiba-inu", nameEn: "Shiba Inu", nameSv: "Shiba" },
  { id: "shih-tzu", nameEn: "Shih Tzu", nameSv: "Shih tzu" },
  { id: "siberian-husky", nameEn: "Siberian Husky", nameSv: "Siberian husky" },
  { id: "silky-terrier", nameEn: "Silky Terrier", nameSv: "Silky terrier" },
  { id: "soft-coated-wheaten-terrier", nameEn: "Soft Coated Wheaten Terrier", nameSv: "Wheaten terrier" },
  { id: "spanish-water-dog", nameEn: "Spanish Water Dog", nameSv: "Spansk vattenhund" },
  { id: "staffordshire-bull-terrier", nameEn: "Staffordshire Bull Terrier", nameSv: "Staffordshire bullterrier" },
  { id: "standard-schnauzer", nameEn: "Standard Schnauzer", nameSv: "Schnauzer" },
  { id: "sussex-spaniel", nameEn: "Sussex Spaniel", nameSv: "Sussex spaniel" },
  { id: "tibetan-mastiff", nameEn: "Tibetan Mastiff", nameSv: "Tibetansk mastiff" },
  { id: "tibetan-terrier", nameEn: "Tibetan Terrier", nameSv: "Tibetansk terrier" },
  { id: "vizsla", nameEn: "Vizsla", nameSv: "Vizsla" },
  { id: "weimaraner", nameEn: "Weimaraner", nameSv: "Weimaraner" },
  { id: "welsh-terrier", nameEn: "Welsh Terrier", nameSv: "Welshterrier" },
  { id: "west-highland-white-terrier", nameEn: "West Highland White Terrier", nameSv: "West highland white terrier" },
  { id: "whippet", nameEn: "Whippet", nameSv: "Whippet" },
  { id: "wire-fox-terrier", nameEn: "Wire Fox Terrier", nameSv: "Foxterrier strävhårig" },
  { id: "yorkshire-terrier", nameEn: "Yorkshire Terrier", nameSv: "Yorkshireterrier" },
];

const BY_ID = new Map(BREEDS.map((breed) => [breed.id, breed]));
const BY_NAME = new Map(
  BREEDS.flatMap((breed) => [
    [norm(breed.nameEn), breed],
    [norm(breed.nameSv), breed],
    [norm(breed.id), breed],
  ]),
);

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findBreed(value: string): Breed | null {
  const key = norm(value);
  if (!key) return null;
  return BY_ID.get(value) ?? BY_NAME.get(key) ?? null;
}

export function breedCatalogForPrompt(): string {
  return BREEDS.map((breed) => `${breed.id}|${breed.nameEn}|${breed.nameSv}`).join("; ");
}
