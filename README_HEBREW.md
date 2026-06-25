# Hack Zone V65 — תיקון שלוש נקודות + אדמין

מה תוקן:
- שלוש הנקודות ליד כל שחקן פותחות עכשיו תפריט צף חזק.
- תפריט הפעולות לא נחתך ולא נעלם בתוך הכרטיס.
- מצב אדמין חזר.
- אדמין מופיע אם שם המשחק הוא בדיוק: עמית
- אדמין יכול: לתת/להוריד מוצרים, לאפס ניסיונות, לחייב החלפת קוד, לתת/להסיר באן.
- עדיין שחקנים אמיתיים מחוברים דרך Realtime Database.

Rules ל-Realtime Database:

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

להעלות ל-GitHub:
- index.html
- style.css
- script.js
- README_HEBREW.md
- UPLOAD_TO_GITHUB_HEBREW.md

אחרי העלאה:
- Commit changes
- לחכות דקה
- Ctrl + F5 באתר
