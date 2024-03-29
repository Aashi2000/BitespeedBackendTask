var express = require('express');
var sqlite3 = require('sqlite3');
var app = express();
var PORT = process.env.PORT || 3000;
var db = new sqlite3.Database(':memory:');

db.serialize(function () {
    db.run("\n    CREATE TABLE IF NOT EXISTS Contact (\n      id INTEGER PRIMARY KEY,\n      phoneNumber TEXT,\n      email TEXT,\n      linkedId INTEGER,\n      linkPrecedence TEXT,\n      createdAt TEXT,\n      updatedAt TEXT,\n      deletedAt TEXT\n    )\n  ");
});

app.use(express.json());
app.post('/identify', function (req, res) {
    var _a = req.body, email = _a.email, phoneNumber = _a.phoneNumber;
    if (!email && !phoneNumber) {
        return res.status(400).json({ error: 'Email or phoneNumber is required' });
    }
    var query = "\n    SELECT * FROM Contact WHERE email = ? OR phoneNumber = ? \n    ORDER BY linkPrecedence DESC, createdAt ASC\n  ";
    db.all(query, [email, phoneNumber], function (err, rows) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (rows.length === 0) {
            db.run("\n        INSERT INTO Contact (phoneNumber, email, linkPrecedence, createdAt)\n        VALUES (?, ?, ?, ?)\n      ", [phoneNumber, email, 'primary', new Date().toISOString()], function (err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }
                var primaryContactId = this.lastID;
                return res.status(200).json({
                    contact: {
                        primaryContactId: primaryContactId,
                        emails: [email],
                        phoneNumbers: [phoneNumber],
                        secondaryContactIds: [],
                    },
                });
            });
        }
        else {
            var primaryContact = rows.find(function (row) { return row.linkPrecedence === 'primary'; });
            if (!primaryContact) {
                return res.status(500).json({ error: 'Primary contact not found' });
            }
            var primaryContactId_1 = primaryContact.id;
            var existingPhoneNumbers = new Set(rows.map(function (row) { return row.phoneNumber; }));
            var phoneNumbers_1 = Array.from(existingPhoneNumbers);
            var existingEmails = new Set(rows.map(function (row) { return row.email; }));
            var emails_1 = Array.from(existingEmails);
            if (!existingPhoneNumbers.has(phoneNumber)) {
                phoneNumbers_1.push(phoneNumber);
            }
            if (!existingEmails.has(email)) {
                emails_1.push(email);
            }
            var secondaryContactIds_1 = rows
                .filter(function (row) { return row.linkPrecedence === 'secondary'; })
                .map(function (contact) { return contact.id; });
            if (!existingPhoneNumbers.has(phoneNumber) || !existingEmails.has(email)) {
                db.run("\n          INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt)\n          VALUES (?, ?, ?, ?, ?)\n        ", [phoneNumber, email, primaryContactId_1, 'secondary', new Date().toISOString()], function (err) {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    var secondaryContactId = this.lastID;
                    secondaryContactIds_1.push(secondaryContactId);
                    return res.status(200).json({
                        contact: {
                            primaryContactId: primaryContactId_1,
                            emails: emails_1,
                            phoneNumbers: phoneNumbers_1,
                            secondaryContactIds: secondaryContactIds_1,
                        },
                    });
                });
            }
            else {
                return res.status(200).json({
                    contact: {
                        primaryContactId: primaryContactId_1,
                        emails: emails_1,
                        phoneNumbers: phoneNumbers_1,
                        secondaryContactIds: secondaryContactIds_1,
                    },
                });
            }
        }
    });
});


app.listen(PORT, function () {
    console.log("Server is running on port ".concat(PORT));
});
