import { DayOfTheWeek } from 'src/lib/Date';
import type { TeamConfig } from 'src/models/Team';
import { VenueName } from 'src/models/Venue';
import {
    People,
    peopleContactMap,
} from 'config/Contacts.example';


export const teams: TeamConfig[] = [
    {
        additionalContacts: [
            peopleContactMap[People.VolleyballPlayer_EmailExample],
        ],
        league: {
            dayOfTheWeek: DayOfTheWeek.Wednesday,
            id: '100',
            venue: {
                name: VenueName.ToledoSportAndSocialClub,
            },
        },
        members: [
            peopleContactMap[People.VolleyballPlayer_PhoneExample],
        ],
        name: '6 Pack',
    },
];

