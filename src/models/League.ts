import type { Merge, StrictOmit } from 'ts-essentials';

import type { Day } from 'src/lib/Date';
import type { Venue, VenueLite } from 'src/models/Venue';


export type League = {
    id: string;
    name: string;
    venue: Venue;
};

export type LeagueConfig = Merge<
    StrictOmit<League, 'name' | 'venue'>,
    {
        dayOfTheWeek: Day;
        venue: VenueLite;
    }
>;
