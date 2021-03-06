import * as DateFns from 'date-fns';

import { People } from 'config/Contacts';
import { teamConfigs } from 'config/Teams';
import { DayOfTheWeek, getDayOfTheWeekFromDate } from 'src/lib/Date';
import {
    createMailOptions,
    createTransporter,
    getMailAddressFromContact,
} from 'src/lib/Mail/Transporter';
import { createMessageFromMatch } from 'src/lib/Message';
import { getMatchesForTeam } from 'src/lib/Parser';


// TODO - Utilize Yargs
const SHOULD_SEND_TEXT_MESSAGES = true;
const OVERRIDE_DATE = '';
const ME: People | null = null;
const SHOULD_ONLY_SEND_TO_ME = false;


(async () => {
    await main();
    // await findScheduleConflicts();
    // await getDayPlayerGameTimesAndDifference(DAY_OF_THE_WEEK, PLAYER);
    // getTeamConfigs();
})().catch(err => {
    console.error(err);
    process.exit();
});


// eslint-disable-next-line max-statements
async function main(): Promise<void> {
    const transporter = await createTransporter();

    const today = OVERRIDE_DATE
        ? new Date(OVERRIDE_DATE + ' 12:00:00')
        : new Date();
    const dayOfTheWeek = getDayOfTheWeekFromDate(today);

    for (const teamConfig of teamConfigs) {
        if (teamConfig.league.dayOfTheWeek !== dayOfTheWeek) {
            continue;
        }
        console.log(`- Parsing ${teamConfig.name}.`);

        const matches = await getMatchesForTeam(teamConfig);
        const todaysMatches = matches.filter(match => DateFns.isSameDay(match.datetime, today));

        for (const match of todaysMatches) {
            const message = await createMessageFromMatch(match);

            const contacts = [
                ...match.team.members,
                ...match.team.additionalContacts,
            ];

            const time = DateFns.format(
                match.datetime,
                'h:mm a',
            );
            console.log(`  - ${time} - Court ${match.court}`);
            console.log(`  - ${match.league.name}`);

            for (const contact of contacts) {
                const isSendingToMe = contact.name === ME;
                if (SHOULD_ONLY_SEND_TO_ME && !isSendingToMe) {
                    continue;
                }
                const mailAddress = getMailAddressFromContact(contact);
                const mailOptions = createMailOptions({
                    text: message,
                    to: mailAddress.address,
                });

                console.log(`    - Sending alert to ${contact.name} (${mailAddress.address}).`);

                if (SHOULD_SEND_TEXT_MESSAGES) {
                    const sentMessageInfo = await transporter.sendMail(mailOptions);
                    console.log(`      - ${sentMessageInfo.response}`);

                    if (sentMessageInfo.rejected.length) {
                        console.error(`Email Send Rejected: ${sentMessageInfo.rejected[0]}`);
                    }
                }
            }
            console.log('\n');
        }
    }
}

// eslint-disable-next-line max-statements
async function findScheduleConflicts(): Promise<void> {
    type DatetimeMemberGameMap = {
        [datetime: string]: {
            [member: string]: string[];
        };
    };
    const datetimeMemberGameMap: DatetimeMemberGameMap = {};
    for (const teamConfig of teamConfigs) {
        const matches = await getMatchesForTeam(teamConfig);
        for (const match of matches) {
            for (const member of match.team.members) {
                const memberName = member.name;
                const datetime = DateFns.format(
                    match.datetime,
                    'MMMM do, yyyy h:mm a',
                );

                const gameInfo = [
                    match.league.name,
                    `Court ${match.court}`,
                    datetime,
                    match.team.name,
                    memberName,
                ].join(' - ');

                const doesDatetimeExistInGameMap = datetime in datetimeMemberGameMap;
                if (!doesDatetimeExistInGameMap) {
                    datetimeMemberGameMap[datetime] = {};
                }
                const doesMemberExistInGameMapDatetime = memberName in datetimeMemberGameMap[datetime];
                if (!doesMemberExistInGameMapDatetime) {
                    datetimeMemberGameMap[datetime][memberName] = [];
                }
                datetimeMemberGameMap[datetime][member.name].push(gameInfo);
            }
        }
    }

    const gameSets: string[][] = [];
    for (const datetime of Object.keys(datetimeMemberGameMap)) {
        for (const member of Object.keys(datetimeMemberGameMap[datetime])) {
            const gameInfo = datetimeMemberGameMap[datetime][member];
            gameSets.push(gameInfo);
        }
    }

    const gameConflicts = gameSets.filter(game => game.length > 1);

    console.log(gameConflicts);
}


async function getDayPlayerGameTimesAndDifference(day: DayOfTheWeek, player: People): Promise<void> {
    type DateMatchMap = Record<string, {
        times: string[];
        timeValues: number[];
    }>;

    const dateMatchMap: DateMatchMap = {};
    for (const teamConfig of teamConfigs) {
        const doesTeamPlayOnDayOfWeek = teamConfig.league.dayOfTheWeek === day;
        const isPlayerOnTeam = Boolean(teamConfig.members.filter(member => member.name === player).length);
        if (!doesTeamPlayOnDayOfWeek || !isPlayerOnTeam) {
            continue;
        }

        const matches = await getMatchesForTeam(teamConfig);
        for (const match of matches) {
            const dateKey = DateFns.format(
                match.datetime,
                'MMM d',
            );

            const doesDateExistInMap = dateKey in dateMatchMap;
            if (!doesDateExistInMap) {
                dateMatchMap[dateKey] = {
                    times: [],
                    timeValues: [],
                };
            }

            const time = DateFns.format(
                match.datetime,
                'h:mm a',
            );
            dateMatchMap[dateKey].times.push(time);

            const timeValue = DateFns.format(
                match.datetime,
                'h',
            );
            dateMatchMap[dateKey].timeValues.push(Number(timeValue));
        }
    }

    for (const dateKey of Object.keys(dateMatchMap)) {
        dateMatchMap[dateKey].times = dateMatchMap[dateKey].times.sort();
        dateMatchMap[dateKey].timeValues = dateMatchMap[dateKey].timeValues.sort();

        const [
            time1,
            time2,
        ] = dateMatchMap[dateKey].timeValues;
        const difference = time2 - time1 + -1;

        console.log(`${dateKey}\t- ${difference} hour wait.`);
    }
}


function getTeamConfigs(): void {
    console.log(
        JSON.stringify(teamConfigs, null, 4),
    );
}
