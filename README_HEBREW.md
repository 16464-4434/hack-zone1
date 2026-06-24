# Hack Zone V63 — שחקנים אמיתיים + כל סוגי הפריצות במשחק

העיצוב נשאר מהגרסה שלך.
אין בוטים.

נוסף:
- פריצה רגילה עם קוד 3 ספרות
- סורק 10
- סורק 100
- רמז ספרה ראשונה
- רמז 2 ספרות
- מתקפת מזל
- פיצוח אוטומטי
- דו־קרב
- מגן פריצה
- מגן דו־קרב
- בוסט כפול
- ביטוח פריצה
- כספת 500
- ניסיון יומי נוסף
- מלכודת פריצה
- מפתח קירור
- מסך “נפרצת”
- יומן אירועים
- לוח ניקוד של מחוברים

חשוב: זה משחק לימודי בלבד. “קוד המשחק” הוא לא סיסמה אמיתית.

Rules ל־Realtime Database:

```json
{
  "rules": {
    "players": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "attacks": {
      "$targetUid": {
        ".read": "auth != null && auth.uid === $targetUid",
        "$attackId": {
          ".write": "auth != null && (auth.uid === $targetUid || (!data.exists() && newData.child('fromUid').val() === auth.uid && newData.child('createdAt').isNumber() && newData.child('type').isString()))"
        }
      }
    }
  }
}
```
