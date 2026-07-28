import { hash } from 'bcryptjs';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
const database = process.env.MONGODB_DB_NAME ?? 'mcp_books_poc';
const password = process.env.DEMO_USER_PASSWORD;

if (!uri || !password) {
  throw new Error('MONGODB_URI and DEMO_USER_PASSWORD are required');
}

const people = [
  {
    email: process.env.DEMO_USER_EMAIL ?? 'reader@example.com',
    displayName: process.env.DEMO_USER_NAME ?? 'Demo Reader',
    books: [
      {
        title: 'The Left Hand of Darkness',
        author: 'Ursula K. Le Guin',
        description:
          'A diplomatic journey across a frozen world that explores culture and identity.',
        publishedYear: 1969,
        status: 'read',
      },
      {
        title: 'The Pragmatic Programmer',
        author: 'Andrew Hunt and David Thomas',
        description:
          'Practical habits for building adaptable, maintainable software.',
        publishedYear: 1999,
        status: 'reading',
      },
      {
        title: 'A Short History of Nearly Everything',
        author: 'Bill Bryson',
        description:
          'An approachable tour through scientific discoveries and the people behind them.',
        publishedYear: 2003,
        status: 'to_read',
      },
      {
        title: 'The Name of the Rose',
        author: 'Umberto Eco',
        description:
          'A medieval mystery set inside a monastery with a dangerous library.',
        publishedYear: 1980,
        status: 'read',
      },
      {
        title: 'Braiding Sweetgrass',
        author: 'Robin Wall Kimmerer',
        description:
          'Essays connecting botany, Indigenous knowledge, and reciprocal care.',
        publishedYear: 2013,
        status: 'reading',
      },
      {
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        description:
          'A study of how thoughtful design makes everyday objects easier to use.',
        publishedYear: 1988,
        status: 'to_read',
      },
      {
        title: 'Season of Migration to the North',
        author: 'Tayeb Salih',
        description:
          'A layered novel about return, memory, and cultural displacement.',
        publishedYear: 1966,
        status: 'read',
      },
      {
        title: 'Invisible Cities',
        author: 'Italo Calvino',
        description:
          'Imagined conversations describing cities that bend memory and desire.',
        publishedYear: 1972,
        status: 'to_read',
      },
    ],
  },
  {
    email: 'maya.reader@example.com',
    displayName: 'Maya Reader',
    books: [
      {
        title: 'Pachinko',
        author: 'Min Jin Lee',
        description: 'A multigenerational family story spanning Korea and Japan.',
        publishedYear: 2017,
        status: 'reading',
      },
      {
        title: 'The Dispossessed',
        author: 'Ursula K. Le Guin',
        description:
          'A physicist crosses between two societies built on opposing ideals.',
        publishedYear: 1974,
        status: 'read',
      },
      {
        title: 'Ways of Seeing',
        author: 'John Berger',
        description:
          'A concise exploration of how images shape culture and perception.',
        publishedYear: 1972,
        status: 'to_read',
      },
    ],
  },
  {
    email: 'omar.books@example.com',
    displayName: 'Omar Books',
    books: [
      {
        title: 'The Master and Margarita',
        author: 'Mikhail Bulgakov',
        description:
          'Satire, romance, and the supernatural collide in Moscow.',
        publishedYear: 1967,
        status: 'read',
      },
      {
        title: 'Algorithms to Live By',
        author: 'Brian Christian and Tom Griffiths',
        description:
          'Computer science ideas applied to familiar choices and daily decisions.',
        publishedYear: 2016,
        status: 'reading',
      },
      {
        title: 'The Shadow of the Wind',
        author: 'Carlos Ruiz Zafón',
        description:
          'A literary mystery centered on a forgotten book in postwar Barcelona.',
        publishedYear: 2001,
        status: 'to_read',
      },
    ],
  },
  {
    email: 'leila.library@example.com',
    displayName: 'Leila Library',
    books: [
      {
        title: 'Homegoing',
        author: 'Yaa Gyasi',
        description:
          'Interconnected stories tracing two branches of a family across generations.',
        publishedYear: 2016,
        status: 'read',
      },
      {
        title: 'The Art of Statistics',
        author: 'David Spiegelhalter',
        description:
          'Clear explanations of how data can answer questions without misleading us.',
        publishedYear: 2019,
        status: 'reading',
      },
      {
        title: 'The Overstory',
        author: 'Richard Powers',
        description:
          'Lives converge around forests, activism, and the scale of ecological time.',
        publishedYear: 2018,
        status: 'to_read',
      },
    ],
  },
];

const connection = await mongoose
  .createConnection(uri, { dbName: database, serverSelectionTimeoutMS: 20_000 })
  .asPromise();

try {
  const users = connection.collection('users');
  const books = connection.collection('books');
  const passwordHash = await hash(password, 12);
  const now = new Date();
  const seededUsers = [];

  for (const person of people) {
    const email = person.email.toLowerCase();
    await users.updateOne(
      { email },
      {
        $set: {
          displayName: person.displayName,
          passwordHash,
          updatedAt: now,
        },
        $setOnInsert: { email, createdAt: now },
      },
      { upsert: true },
    );
    const user = await users.findOne({ email });
    seededUsers.push({ ...person, id: user._id });
  }

  await books.deleteMany({
    ownerId: { $in: seededUsers.map((person) => person.id) },
  });

  const bookDocuments = seededUsers.flatMap((person, personIndex) =>
    person.books.map((book, bookIndex) => {
      const createdAt = new Date(
        now.getTime() - (personIndex * 10 + bookIndex) * 86_400_000,
      );
      return {
        ...book,
        ownerId: person.id,
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );

  await books.insertMany(bookDocuments);
  await users.createIndex({ email: 1 }, { unique: true });
  await books.createIndex({ ownerId: 1, createdAt: -1 });

  console.log(
    JSON.stringify({
      database,
      users: seededUsers.length,
      books: bookDocuments.length,
      primaryUser: seededUsers[0].email,
    }),
  );
} finally {
  await connection.close();
}
