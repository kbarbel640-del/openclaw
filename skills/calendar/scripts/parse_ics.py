#!/usr/bin/env python3
"""Parse ICS feed and output calendar events in structured format.

Usage:
    parse_ics.py <command> [args]
    
Commands:
    today              - Today's events
    upcoming [N]       - Next N days (default 7)
    next               - Next upcoming event
    free               - Free time blocks today
    week               - Week overview (event counts per day)

Output format: TIME | CALENDAR | TITLE | LINK
"""

import sys
import os
import re
from datetime import datetime, date, timedelta, time
from pathlib import Path

from icalendar import Calendar
from dateutil import rrule as du_rrule
from dateutil.tz import gettz, tzutc

# Windows timezone name → IANA mapping
WIN_TZ_MAP = {
    "GMT Standard Time": "Europe/London",
    "Romance Standard Time": "Europe/Paris",
    "Eastern Standard Time": "America/New_York",
    "Pacific Standard Time": "America/Los_Angeles",
    "Central Standard Time": "America/Chicago",
    "Arabian Standard Time": "Asia/Dubai",
    "Sri Lanka Standard Time": "Asia/Colombo",
    "UTC": "UTC",
    "W. Europe Standard Time": "Europe/Berlin",
    "Central European Standard Time": "Europe/Warsaw",
    "AUS Eastern Standard Time": "Australia/Sydney",
    "India Standard Time": "Asia/Kolkata",
    "Tokyo Standard Time": "Asia/Tokyo",
    "China Standard Time": "Asia/Shanghai",
    "Mountain Standard Time": "America/Denver",
    "SA Pacific Standard Time": "America/Bogota",
    "SE Asia Standard Time": "Asia/Bangkok",
    "Singapore Standard Time": "Asia/Singapore",
    "Israel Standard Time": "Asia/Jerusalem",
    "South Africa Standard Time": "Africa/Johannesburg",
    "FLE Standard Time": "Europe/Helsinki",
    "E. Europe Standard Time": "Europe/Chisinau",
    "GTB Standard Time": "Europe/Bucharest",
    "Russian Standard Time": "Europe/Moscow",
    "New Zealand Standard Time": "Pacific/Auckland",
    "Cen. Australia Standard Time": "Australia/Adelaide",
    "E. Australia Standard Time": "Australia/Brisbane",
    "Hawaiian Standard Time": "Pacific/Honolulu",
    "Alaskan Standard Time": "America/Anchorage",
    "Atlantic Standard Time": "America/Halifax",
    "Newfoundland Standard Time": "America/St_Johns",
    "US Mountain Standard Time": "America/Phoenix",
    "Canada Central Standard Time": "America/Regina",
    "E. South America Standard Time": "America/Sao_Paulo",
    "West Pacific Standard Time": "Pacific/Port_Moresby",
    "Taipei Standard Time": "Asia/Taipei",
    "Korea Standard Time": "Asia/Seoul",
}

# Load config
def load_config():
    config = {}
    config_path = Path(__file__).parent.parent / "config.env"
    if config_path.exists():
        for line in config_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                config[k.strip()] = v.strip().strip('"').strip("'")
    return config

CONFIG = load_config()
LOCAL_TZ = gettz(CONFIG.get("LOCAL_TZ", "Europe/London"))
WORK_START = int(CONFIG.get("WORK_HOURS_START", "9"))
WORK_END = int(CONFIG.get("WORK_HOURS_END", "17"))


def resolve_tz(dt):
    """Ensure a datetime has timezone info, converting Windows TZ names."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=tzutc())
    # icalendar sometimes stores TZID as a string in the params
    tzname = str(dt.tzinfo)
    if tzname in WIN_TZ_MAP:
        iana = gettz(WIN_TZ_MAP[tzname])
        if iana:
            return dt.replace(tzinfo=iana)
    return dt


def to_local(dt):
    """Convert datetime to local timezone."""
    if isinstance(dt, date) and not isinstance(dt, datetime):
        return dt
    dt = resolve_tz(dt)
    return dt.astimezone(LOCAL_TZ)


def extract_link(text):
    """Extract meeting link from text."""
    if not text:
        return ""
    patterns = [
        r'(https://[^\s<>]*zoom\.us/j/[^\s<>]*)',
        r'(https://teams\.microsoft\.com/[^\s<>]*)',
        r'(https://meet\.google\.com/[^\s<>]*)',
    ]
    for p in patterns:
        m = re.search(p, str(text))
        if m:
            return m.group(1)
    return ""


def parse_ics(ics_text):
    """Parse ICS text and return list of (summary, dtstart, dtend, location, description, rrule, exdates, status, uid)."""
    cal = Calendar.from_ical(ics_text)
    events = []
    for comp in cal.walk():
        if comp.name != "VEVENT":
            continue
        summary = str(comp.get("SUMMARY", ""))
        dtstart = comp.get("DTSTART")
        dtend = comp.get("DTEND")
        location = str(comp.get("LOCATION", "") or "")
        description = str(comp.get("DESCRIPTION", "") or "")
        status = str(comp.get("STATUS", "") or "")
        uid = str(comp.get("UID", "") or "")
        rrule_prop = comp.get("RRULE")
        
        # Collect EXDATE values
        exdates = set()
        exdate_prop = comp.get("EXDATE")
        if exdate_prop:
            if isinstance(exdate_prop, list):
                for ex in exdate_prop:
                    if hasattr(ex, 'dts'):
                        for d in ex.dts:
                            exdates.add(to_local(d.dt).date() if isinstance(d.dt, datetime) else d.dt)
                    else:
                        exdates.add(to_local(ex.dt).date() if isinstance(ex.dt, datetime) else ex.dt)
            else:
                if hasattr(exdate_prop, 'dts'):
                    for d in exdate_prop.dts:
                        exdates.add(to_local(d.dt).date() if isinstance(d.dt, datetime) else d.dt)
                else:
                    exdates.add(to_local(exdate_prop.dt).date() if isinstance(exdate_prop.dt, datetime) else exdate_prop.dt)

        if dtstart:
            dtstart = dtstart.dt
        if dtend:
            dtend = dtend.dt

        events.append({
            "summary": summary,
            "dtstart": dtstart,
            "dtend": dtend,
            "location": location,
            "description": description,
            "status": status,
            "uid": uid,
            "rrule": rrule_prop,
            "exdates": exdates,
        })
    return events


def expand_events(events, start_date, end_date):
    """Expand recurring events and filter to date range. Returns list of (summary, start_dt, end_dt, location, description)."""
    result = []
    start_dt = datetime.combine(start_date, time.min).replace(tzinfo=LOCAL_TZ)
    end_dt = datetime.combine(end_date + timedelta(days=1), time.min).replace(tzinfo=LOCAL_TZ)

    for ev in events:
        # Skip cancelled
        if ev["status"].upper() == "CANCELLED":
            continue
        if ev["summary"].lower().startswith("cancel"):
            continue

        dtstart = ev["dtstart"]
        dtend = ev["dtend"]
        if dtstart is None:
            continue

        is_allday = isinstance(dtstart, date) and not isinstance(dtstart, datetime)
        
        if is_allday:
            duration = (dtend - dtstart) if dtend else timedelta(days=1)
        else:
            dtstart_local = to_local(dtstart)
            if dtend:
                dtend_local = to_local(dtend)
                duration = dtend_local - dtstart_local
            else:
                duration = timedelta(hours=1)

        link = extract_link(ev["location"]) or extract_link(ev["description"])

        if ev["rrule"]:
            # Build rrule
            rule_dict = dict(ev["rrule"])
            # Convert rrule params
            freq_map = {"YEARLY": 0, "MONTHLY": 1, "WEEKLY": 2, "DAILY": 3, "HOURLY": 4, "MINUTELY": 5, "SECONDLY": 6}
            freq = rule_dict.get("FREQ", ["WEEKLY"])[0]
            
            kwargs = {"dtstart": dtstart if isinstance(dtstart, datetime) else datetime.combine(dtstart, time.min)}
            if not isinstance(kwargs["dtstart"], datetime):
                kwargs["dtstart"] = datetime.combine(kwargs["dtstart"], time.min)
            if kwargs["dtstart"].tzinfo is None:
                kwargs["dtstart"] = kwargs["dtstart"].replace(tzinfo=LOCAL_TZ)
            else:
                kwargs["dtstart"] = resolve_tz(kwargs["dtstart"])
            
            kwargs["freq"] = freq_map.get(freq, 2)
            
            if "INTERVAL" in rule_dict:
                kwargs["interval"] = int(rule_dict["INTERVAL"][0])
            if "COUNT" in rule_dict:
                kwargs["count"] = int(rule_dict["COUNT"][0])
            if "UNTIL" in rule_dict:
                until = rule_dict["UNTIL"][0]
                if isinstance(until, datetime):
                    if until.tzinfo is None:
                        until = until.replace(tzinfo=tzutc())
                    kwargs["until"] = until
                elif isinstance(until, date):
                    kwargs["until"] = datetime.combine(until, time.max).replace(tzinfo=tzutc())
            if "BYDAY" in rule_dict:
                day_map = {"MO": du_rrule.MO, "TU": du_rrule.TU, "WE": du_rrule.WE, 
                          "TH": du_rrule.TH, "FR": du_rrule.FR, "SA": du_rrule.SA, "SU": du_rrule.SU}
                bydays = []
                for d in rule_dict["BYDAY"]:
                    ds = str(d)
                    # Handle things like "-1SU" or "2MO"
                    if ds[-2:] in day_map:
                        prefix = ds[:-2]
                        day_obj = day_map[ds[-2:]]
                        if prefix and prefix not in ("+", "-"):
                            try:
                                day_obj = day_obj(int(prefix))
                            except:
                                pass
                        elif prefix == "-":
                            pass  # just use the day
                        bydays.append(day_obj)
                    elif ds in day_map:
                        bydays.append(day_map[ds])
                if bydays:
                    kwargs["byweekday"] = bydays
            if "BYMONTH" in rule_dict:
                kwargs["bymonth"] = [int(m) for m in rule_dict["BYMONTH"]]
            if "BYMONTHDAY" in rule_dict:
                kwargs["bymonthday"] = [int(m) for m in rule_dict["BYMONTHDAY"]]
            if "WKST" in rule_dict:
                wkst_map = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
                kwargs["wkst"] = wkst_map.get(str(rule_dict["WKST"][0]), 0)
            
            try:
                rule = du_rrule.rrule(**kwargs)
                # Limit expansion
                for occ in rule.between(start_dt, end_dt, inc=True):
                    occ_local = occ.astimezone(LOCAL_TZ) if isinstance(occ, datetime) else occ
                    occ_date = occ_local.date() if isinstance(occ_local, datetime) else occ_local
                    if occ_date in ev["exdates"]:
                        continue
                    if is_allday:
                        result.append((ev["summary"], occ_date, occ_date + duration, "", link))
                    else:
                        occ_end = occ_local + duration
                        result.append((ev["summary"], occ_local, occ_end, 
                                      occ_local.strftime("%H:%M") + " - " + occ_end.strftime("%H:%M"), link))
            except Exception as e:
                # If rrule expansion fails, try single instance
                pass
        else:
            # Single event
            if is_allday:
                if dtstart < end_date + timedelta(days=1) and (dtend or dtstart + timedelta(days=1)) > start_date:
                    result.append((ev["summary"], dtstart, dtend, "", link))
            else:
                dtstart_local = to_local(dtstart)
                dtend_local = to_local(dtend) if dtend else dtstart_local + timedelta(hours=1)
                if dtstart_local < end_dt and dtend_local > start_dt:
                    time_str = dtstart_local.strftime("%H:%M") + " - " + dtend_local.strftime("%H:%M")
                    result.append((ev["summary"], dtstart_local, dtend_local, time_str, link))

    # Sort by start
    result.sort(key=lambda x: (
        x[1] if isinstance(x[1], datetime) else datetime.combine(x[1], time.min).replace(tzinfo=LOCAL_TZ)
    ))
    return result


def format_event(ev):
    """Format event tuple to output string."""
    summary, start, end, time_str, link = ev
    t = time_str if time_str else "all-day"
    cal = "Work"
    if link:
        return f"{t} | {cal} | {summary} | {link}"
    return f"{t} | {cal} | {summary}"


def fetch_ics():
    """Fetch ICS from configured URL."""
    import subprocess
    url = CONFIG.get("ICS_FEED_URL", "")
    if not url:
        return None
    try:
        result = subprocess.run(["curl", "-s", "--max-time", "10", url], 
                               capture_output=True, text=True, timeout=15)
        if result.returncode == 0 and result.stdout.startswith("BEGIN:VCALENDAR"):
            return result.stdout
    except:
        pass
    return None


def cmd_today(events_raw):
    today = date.today()
    events = expand_events(events_raw, today, today)
    if not events:
        print("No events today (from ICS feed).")
        return
    print("📅 Today's Events (Work)")
    print("---")
    for ev in events:
        print(format_event(ev))


def cmd_upcoming(events_raw, days=7):
    today = date.today()
    end = today + timedelta(days=days - 1)
    events = expand_events(events_raw, today, end)
    if not events:
        print(f"No events in the next {days} days (from ICS feed).")
        return
    print(f"📅 Next {days} Days (Work)")
    print("---")
    current_date = None
    for ev in events:
        ev_date = ev[1].date() if isinstance(ev[1], datetime) else ev[1]
        if ev_date != current_date:
            current_date = ev_date
            print(f"\n### {current_date.strftime('%d %b %Y (%A)')}")
        print(format_event(ev))


def cmd_next(events_raw):
    today = date.today()
    now = datetime.now(LOCAL_TZ)
    events = expand_events(events_raw, today, today)
    for ev in events:
        if isinstance(ev[1], datetime) and ev[1] > now:
            print(format_event(ev))
            return
    # Check tomorrow
    events = expand_events(events_raw, today + timedelta(days=1), today + timedelta(days=1))
    if events:
        print(format_event(events[0]))
        return
    print("No upcoming events found.")


def cmd_free(events_raw):
    today = date.today()
    events = expand_events(events_raw, today, today)
    
    print(f"🕐 Free Time Blocks Today ({WORK_START}:00-{WORK_END}:00) — Work calendar")
    print("---")
    
    # Collect busy intervals as minutes from midnight
    busy = []
    for ev in events:
        if isinstance(ev[1], datetime):
            s = ev[1].hour * 60 + ev[1].minute
            e = ev[2].hour * 60 + ev[2].minute if isinstance(ev[2], datetime) else s + 60
            busy.append((max(s, WORK_START * 60), min(e, WORK_END * 60)))
    
    busy.sort()
    cursor = WORK_START * 60
    end_of_day = WORK_END * 60
    has_free = False
    
    for s, e in busy:
        if s > cursor:
            dur = s - cursor
            print(f"{cursor//60:02d}:{cursor%60:02d} - {s//60:02d}:{s%60:02d} ({dur} min)")
            has_free = True
        cursor = max(cursor, e)
    
    if cursor < end_of_day:
        dur = end_of_day - cursor
        print(f"{cursor//60:02d}:{cursor%60:02d} - {end_of_day//60:02d}:{end_of_day%60:02d} ({dur} min)")
        has_free = True
    
    if not has_free:
        print("No free blocks during work hours.")


def cmd_week(events_raw):
    today = date.today()
    end = today + timedelta(days=6)
    events = expand_events(events_raw, today, end)
    
    print("📅 Week Overview (Work)")
    print("---")
    
    counts = {}
    for ev in events:
        ev_date = ev[1].date() if isinstance(ev[1], datetime) else ev[1]
        counts[ev_date] = counts.get(ev_date, 0) + 1
    
    for i in range(7):
        d = today + timedelta(days=i)
        c = counts.get(d, 0)
        print(f"{d.strftime('%d %b %Y (%A)')}  {c} events")


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "today"
    
    ics_text = fetch_ics()
    if not ics_text:
        print("ERROR: Failed to fetch ICS feed", file=sys.stderr)
        sys.exit(1)
    
    events_raw = parse_ics(ics_text)
    
    if cmd == "today":
        cmd_today(events_raw)
    elif cmd == "upcoming":
        days = int(args[1]) if len(args) > 1 else 7
        cmd_upcoming(events_raw, days)
    elif cmd == "next":
        cmd_next(events_raw)
    elif cmd == "free":
        cmd_free(events_raw)
    elif cmd == "week":
        cmd_week(events_raw)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
