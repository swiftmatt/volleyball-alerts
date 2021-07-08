import * as DateFns from 'date-fns';
import { JSDOM } from 'jsdom';
import { URL } from 'url';

import { getDomFromUrl } from 'src/lib/Parser';
import {
    getFirstValueAtXpath,
    getNodeAtXpath,
} from 'src/lib/Parser/xpath';
import {
    isNil,
    isTwoNumberArray,
} from 'src/lib/Util';
import { League } from 'src/models/League';
import {
    Match,
    MatchParsed,
} from 'src/models/Match';
import {
    Team,
    TeamConfig,
    TeamParsed,
} from 'src/models/Team';
import {
    getVenueInfoFromVenueName,
    Venue,
} from 'src/models/Venue';


function createForestViewLanesUrl(teamConfig: TeamConfig, venue: Venue): string {
    const { baseUrl } = venue;
    const { id } = teamConfig.league;

    const url = new URL(`${baseUrl}/teaminfo/${id}`);
    return url.toString();
}

function getCourt(dom: JSDOM, contextNode: Node): MatchParsed['court'] {
    const court = getFirstValueAtXpath({
        contextNode,
        dom,
        xpath: 'td[3]',
    });
    return Number(court);
}

function getDate(dom: JSDOM, contextNode: Node): string {
    return getFirstValueAtXpath({
        contextNode,
        dom,
        xpath: 'td[1]',
    });
}

function getLeague(dom: JSDOM, teamConfig: TeamConfig, venue: Venue): League {
    const { league } = teamConfig;
    const { id } = league;

    const name = getLeagueName(dom);

    return {
        id,
        name,
        venue,
    };
}

function getLeagueName(dom: JSDOM): League['name'] {
    return getFirstValueAtXpath({
        dom,
        xpath: '/html/body/div[1]/div[3]/div/div/div[5]/table/tbody/tr/td[1]/div/a',
    });
}

function getMatchDatetime(date: string, time: string): MatchParsed['datetime'] {
    return DateFns.parse(
        `${date}_${time}`,
        'yyyy-MM-dd_ha',
        new Date(),
    );
}

function getMatches(matchesParsed: MatchParsed[], team: Team, league: League): Match[] {
    return matchesParsed.map(matchParsed => {
        const {
            court,
            datetime,
            opponentTeam,
        } = matchParsed;

        return {
            court,
            datetime,
            league,
            opponentTeam,
            team,
        };
    });
}

function getMatchesParsed(dom: JSDOM): MatchParsed[] {
    const tableRows = [
        ...getNodeAtXpath(
            dom,
            '/html/body/div[1]/div[3]/div/div/table/tbody/tr/td[2]/div[4]/table/tbody/tr',
            dom.window.document,
        ),
    ];

    // Remove the first row as it's just the table header.
    tableRows.shift();

    return tableRows.map(tableRow => {
        if ( isNil(tableRow) ) {
            throw new Error('A `tableRow` was null.');
        }

        const court = getCourt(dom, tableRow);

        const date = getDate(dom, tableRow);
        const time = getTime(dom, tableRow);
        const datetime = getMatchDatetime(date, time);

        const opponentName = getOpponentName(dom, tableRow);
        const opponentRecord = getOpponentRecord(dom, tableRow);
        const opponentTeam = {
            name: opponentName,
            record: opponentRecord,
        };

        return {
            court,
            datetime,
            opponentTeam,
        };
    });
}

function getOpponentName(dom: JSDOM, contextNode: Node): TeamParsed['name'] {
    return getFirstValueAtXpath({
        contextNode,
        dom,
        xpath: 'td[4]/a[1]',
    });
}

function getOpponentRecord(dom: JSDOM, contextNode: Node): TeamParsed['record'] {
    const opponentRecordRaw = getFirstValueAtXpath({
        contextNode,
        dom,
        xpath: 'td[4]/span[1]',
    });

    const recordRegex = /Current\s*Record:\s*(?<wins>\d+)-(?<loses>\d+)/gmu;
    const recordRegexMatches = recordRegex.exec(opponentRecordRaw);

    const opponentRecordGroups = recordRegexMatches?.groups;
    if (
        isNil(opponentRecordGroups)
        || isNil(opponentRecordGroups.wins)
        || isNil(opponentRecordGroups.loses)
    ) {
        throw new Error(`Unable to parse opponent's record. (${opponentRecordRaw})`);
    }

    const opponentRecord = [
        opponentRecordGroups.wins,
        opponentRecordGroups.loses,
    ].map(Number);

    if ( !isTwoNumberArray(opponentRecord) ) {
        throw new Error(`Unable to parse opponent's record correctly. (${opponentRecordRaw})`);
    }

    return opponentRecord;
}

function getTeam(dom: JSDOM, teamConfig: TeamConfig, url: Team['url']): Team {
    const {
        additionalContacts,
        members,
        name,
    } = teamConfig;

    const record = getTeamRecord(dom, dom.window.document);

    return {
        additionalContacts,
        members,
        name,
        record,
        url,
    };
}

function getTeamRecord(dom: JSDOM, contextNode: Node): TeamParsed['record'] {
    const recordRaw = getFirstValueAtXpath({
        contextNode,
        dom,
        xpath: '/html/body/div[1]/div[3]/div/div/table/tbody/tr/td[2]/div[2]/table/tbody/tr/td[1]',
    });

    const recordRegex = /Games:\s*(?<wins>\d+)\s*- \s*(?<loses>\d+)\s*\(\d+%\)/gmu;
    const recordMatches = recordRegex.exec(recordRaw);

    const teamRecordGroups = recordMatches?.groups;
    if (
        isNil(teamRecordGroups)
        || isNil(teamRecordGroups.wins)
        || isNil(teamRecordGroups.loses)
    ) {
        throw new Error(`Unable to parse team record. (${recordRaw})`);
    }

    const teamRecord = [
        teamRecordGroups.wins,
        teamRecordGroups.loses,
    ].map(Number);

    if ( !isTwoNumberArray(teamRecord) ) {
        throw new Error(`Unable to parse team's record correctly. (${recordRaw})`);
    }

    return teamRecord;
}

function getTime(dom: JSDOM, contextNode: Node): string {
    return getFirstValueAtXpath({
        contextNode,
        dom,
        xpath: 'td[2]',
    });
}

export async function parseForestViewLanesLeague(teamConfig: TeamConfig): Promise<Match[]> {
    const venue = getVenueInfoFromVenueName(teamConfig.league.venue.name);
    const url = createForestViewLanesUrl(teamConfig, venue);

    const dom = await getDomFromUrl(url);
    const matchesParsed = getMatchesParsed(dom);

    const team = getTeam(dom, teamConfig, url);
    const league = getLeague(dom, teamConfig, venue);
    const matches = getMatches(matchesParsed, team, league);

    return matches;
}