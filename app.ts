const express = require('express');
const sqlite3 = require('sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(':memory:');


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Contact (
      id INTEGER PRIMARY KEY,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      deletedAt TEXT
    )
  `);
});

app.use(express.json());

app.post('/identify', (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email or phoneNumber is required' });
  }

  let query = `
    SELECT * FROM Contact WHERE email = ? OR phoneNumber = ? 
    ORDER BY linkPrecedence DESC, createdAt ASC
  `;

  db.all(query, [email, phoneNumber], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (rows.length === 0) {
      db.run(
        `
        INSERT INTO Contact (phoneNumber, email, linkPrecedence, createdAt)
        VALUES (?, ?, ?, ?)
      `,
        [phoneNumber, email, 'primary', new Date().toISOString()],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal Server Error' });
          }

          const primaryContactId = this.lastID;
          return res.status(200).json({
            contact: {
              primaryContactId,
              emails: [email],
              phoneNumbers: [phoneNumber],
              secondaryContactIds: [],
            },
          });
        }
      );
    } else {
      const primaryContact = rows.find((row) => row.linkPrecedence === 'primary');

      if (!primaryContact) {
        return res.status(500).json({ error: 'Primary contact not found' });
      }

      const primaryContactId = primaryContact.id;
      const existingPhoneNumbers = new Set(rows.map((row) => row.phoneNumber));
      let phoneNumbers = Array.from(existingPhoneNumbers);

      const existingEmails = new Set(rows.map((row) => row.email));
      let emails = Array.from(existingEmails);

      if (!existingPhoneNumbers.has(phoneNumber)) {
        phoneNumbers.push(phoneNumber);
      }

      if (!existingEmails.has(email)) {
        emails.push(email);
      }

      const secondaryContactIds = rows
        .filter((row) => row.linkPrecedence === 'secondary')
        .map((contact) => contact.id);

      if (!existingPhoneNumbers.has(phoneNumber) || !existingEmails.has(email)) {
        db.run(
          `
          INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `,
          [phoneNumber, email, primaryContactId, 'secondary', new Date().toISOString()],
          function (err) {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Internal Server Error' });
            }

            const secondaryContactId = this.lastID;
            secondaryContactIds.push(secondaryContactId);

            return res.status(200).json({
              contact: {
                primaryContactId,
                emails,
                phoneNumbers,
                secondaryContactIds,
              },
            });
          }
        );
      } else {
        
        return res.status(200).json({
          contact: {
            primaryContactId,
            emails,
            phoneNumbers,
            secondaryContactIds,
          },
        });
      }
    }
  });
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
