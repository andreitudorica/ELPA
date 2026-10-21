import { z } from 'zod';

export const ONTOLOGY_VERSION = 'grp-attributes@1';

const count = z.number().int().positive().max(100000);
const area = z.number().positive().max(100000000);
const yesNo = z.boolean();

/** Offer attributes describe the advertised accommodation, never its Provider. */
export const ATTRIBUTE_SCHEMAS = {
  sleeps_persons: count,
  bedrooms_count: count,
  bathrooms_count: count,
  exclusive_rental: yesNo,
  yard: yesNo,
  yard_area_m2: area,
  terrain: z.enum(['flat', 'sloped', 'terraced', 'mixed']),
  lawn: yesNo,
  enclosed_yard: yesNo,
  outdoor_grill: yesNo,
  outdoor_covered_area: z.enum(['gazebo', 'covered_seating']),
  outdoor_kitchen: yesNo,
  fire_pit: yesNo,
  pool: yesNo,
  hot_tub: yesNo,
  sauna: yesNo,
  recreation: z.enum([
    'table_tennis',
    'tennis',
    'football',
    'basketball',
    'billiards',
    'playground',
  ]),
  parties_allowed: z.enum(['yes', 'no', 'by_arrangement']),
  team_building: yesNo,
  max_daytime_guests: count,
  music_policy: z.enum(['prohibited', 'amplified_prohibited', 'restricted', 'permitted']),
  outdoor_events: yesNo,
  quiet_hours: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/),
  pool_availability: z.enum(['seasonal', 'year_round']),
  beds_count: count,
} as const;

export type AttributeId = keyof typeof ATTRIBUTE_SCHEMAS;
export const ATTRIBUTE_IDS = Object.keys(ATTRIBUTE_SCHEMAS) as [AttributeId, ...AttributeId[]];
export const attributeIdSchema = z.enum(ATTRIBUTE_IDS);

interface Definition {
  meaning: string;
  unit: string | null;
  rule: string;
  positive: string;
  negative: string;
  ambiguous: string;
  temporal: string;
}

const definition = (
  meaning: string,
  unit: string | null,
  rule: string,
  positive: string,
  negative: string,
  ambiguous: string,
  temporal = 'Observation time only unless the passage states a restriction.',
): Definition => ({ meaning, unit, rule, positive, negative, ambiguous, temporal });

const definitions: Record<AttributeId, Definition> = {
  sleeps_persons: definition(
    'Maximum stated overnight accommodation capacity',
    'persons',
    'Lodging guests only; not seats, events, beds or tents.',
    'Cazare pentru maximum 12 persoane.',
    'Numeric counts have no negative value; zero is not absence.',
    'Capacitate 30 without lodging context.',
  ),
  bedrooms_count: definition(
    'Number of sleeping bedrooms',
    'bedrooms',
    'Dormitoare/bedrooms only; rooms may include other spaces.',
    '6 dormitoare',
    'No negative count.',
    '6 camere; 6 rooms',
  ),
  bathrooms_count: definition(
    'Number of bathrooms for the advertised accommodation',
    'bathrooms',
    'Do not count toilets or shared public facilities as bathrooms.',
    '3 băi',
    'No negative count.',
    'Baie comună without count',
  ),
  exclusive_rental: definition(
    'Whole accommodation can be booked exclusively',
    null,
    'Requires an explicit rental statement; a villa name is insufficient.',
    'Cabana se închiriază integral.',
    'Nu se închiriază integral.',
    'Booking rooms does not exclude a separate whole-property offer.',
  ),
  yard: definition(
    'Yard belonging to the accommodation',
    null,
    'Do not derive from lawn, photographs or nearby parks.',
    'Proprietatea are curte.',
    'Fără curte.',
    'Curtea vecinului',
  ),
  yard_area_m2: definition(
    'Explicitly stated total yard area',
    'm2',
    'Normalize mp/m²/ha; not building, plot or usable event area. Preserve approximations.',
    'Curte de 2.000 mp',
    'No negative area.',
    'Teren de 2.000 mp does not establish yard area.',
  ),
  terrain: definition(
    'Explicit yard terrain shape',
    null,
    'Large does not mean flat; preserve conflicting descriptions.',
    'Curte plană; curte în pantă; curte terasată; curte cu teren mixt.',
    'Not flat does not establish sloped.',
    'Curte mare',
  ),
  lawn: definition(
    'Grass or lawn on the property',
    null,
    'Requires grass/lawn evidence on the property.',
    'Curte cu gazon.',
    'Fără gazon.',
    'Pajiște în apropiere',
  ),
  enclosed_yard: definition(
    'Yard is enclosed',
    null,
    'An enclosure statement does not establish child safety.',
    'Curte împrejmuită.',
    'Curte neîmprejmuită.',
    'Gard appears in a photograph',
  ),
  outdoor_grill: definition(
    'Barbecue available at the property',
    null,
    'Not a nearby restaurant or a ban on lighting fires.',
    'Grătar în curte.',
    'Fără grătar.',
    'Restaurant grill în apropiere',
  ),
  outdoor_covered_area: definition(
    'Gazebo or explicitly covered outdoor seating',
    null,
    'A generic terrace is not a gazebo or covered space.',
    'Foișor; terasă acoperită.',
    'Fără foișor is a negative passage, not a positive enum value.',
    'Terasă without roof statement',
  ),
  outdoor_kitchen: definition(
    'Outdoor kitchen at the property',
    null,
    'Indoor/shared kitchen does not establish outdoor kitchen.',
    'Bucătărie de vară.',
    'Fără bucătărie de vară.',
    'Bucătărie complet utilată',
  ),
  fire_pit: definition(
    'Dedicated outdoor fire pit',
    null,
    'Indoor fireplace and barbecue are separate.',
    'Vatră de foc în curte.',
    'Fără vatră de foc.',
    'Șemineu',
  ),
  pool: definition(
    'Pool belonging to or explicitly offered by the accommodation',
    null,
    'Nearby public pools are excluded; closure in winter is not absence.',
    'Piscină în curte.',
    'Nu avem piscină.',
    'Piscină publică la 500 m',
    'Existence and operating season are separate attributes.',
  ),
  hot_tub: definition(
    'Hot tub or ciubăr offered at the property',
    null,
    'Nearby spas do not qualify; do not infer heating or year-round use.',
    'Ciubăr; hot tub.',
    'Fără ciubăr.',
    'Centru spa în apropiere',
  ),
  sauna: definition(
    'Sauna offered at the property',
    null,
    'Do not infer from spa alone.',
    'Saună.',
    'Nu avem saună.',
    'Acces la spa în oraș',
  ),
  recreation: definition(
    'Explicitly listed recreational facility',
    null,
    'One fact per listed allowed facility; no inferred event suitability.',
    'Masă de ping-pong; teren de tenis.',
    'Negative facility passages are annotated but not positive enum facts.',
    'Football stadium nearby',
  ),
  parties_allowed: definition(
    'Explicit permission or refusal for private parties/events',
    null,
    'Silence, facilities, team-building and marketing photos do not imply permission.',
    'Acceptăm evenimente private.; Petreceri doar cu acord prealabil.',
    'Nu organizăm petreceri.',
    'Ideal pentru grupuri',
  ),
  team_building: definition(
    'Team-building explicitly advertised',
    null,
    'This is an advertisement, not proof of capacity or event permission.',
    'Organizăm team-building.',
    'Nu acceptăm team-building.',
    'Ideal pentru echipe without activity statement',
  ),
  max_daytime_guests: definition(
    'Maximum stated event attendance',
    'persons',
    'Requires event/party attendance context; never reuse overnight capacity.',
    'Evenimente pentru maximum 50 persoane.',
    'No negative count.',
    'Capacitate 50 without event context',
  ),
  music_policy: definition(
    'Explicit music restriction or permission',
    null,
    'Keep restriction text; permission does not imply private-event permission.',
    'Muzica este permisă.',
    'Muzica este interzisă.; Fără muzică amplificată.',
    'Zonă liniștită',
    'Retain hours/season in the supporting passage.',
  ),
  outdoor_events: definition(
    'Explicitly advertised outdoor event hosting',
    null,
    'Yard/gazebo does not establish event suitability or permission.',
    'Organizăm evenimente în aer liber.',
    'Nu acceptăm evenimente în aer liber.',
    'Curte mare pentru relaxare',
  ),
  quiet_hours: definition(
    'Explicit daily quiet-hours interval',
    'local clock time',
    'Normalize an interval to HH:mm-HH:mm; may cross midnight. No timezone conversion.',
    'Ore de liniște 22:00-08:00.',
    'Absence of an interval is unknown.',
    'Liniște după apus',
  ),
  pool_availability: definition(
    'Explicit pool operating season',
    null,
    'Separate from pool existence; a seasonal closure cannot become pool=false.',
    'Piscină deschisă tot anul.; Piscina este închisă iarna.',
    'Negative seasonal closure maps seasonal, not absence.',
    'Piscină încălzită does not mean year-round.',
    'year_round or seasonal; exact source qualification retained.',
  ),
  beds_count: definition(
    'Number of accommodation beds',
    'beds',
    'Beds are not persons or bedrooms; exclude camp pitches.',
    '8 paturi',
    'No negative count.',
    '8 locuri without bed context',
  ),
};

export function ontologyDocument() {
  return {
    version: ONTOLOGY_VERSION,
    attributes: ATTRIBUTE_IDS.map((id) => ({
      id,
      target: `offer.${id}`,
      entityLevel: 'offer',
      ...definitions[id],
      schema: z.toJSONSchema(ATTRIBUTE_SCHEMAS[id]),
      examplesLanguage: 'ro',
      unknown: 'No supported statement; emit no Claim. Never convert silence into false.',
      notApplicable:
        'Annotator judgment with rationale; emit no Claim. Do not infer from property type.',
      negativeSemantics:
        'Boolean false or parties_allowed=no where defined. For positive-only enums/counts, annotate explicit negative without a normalized positive fact.',
    })),
  };
}
