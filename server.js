const cors = require("cors");
const express = require('express');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/getBuildings', async (req, res) => {
	try {
		const rows = await db.query('SELECT DISTINCT building FROM Room');
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/getPopularBuildings', async (req, res) => {
	try {
		const rows = await db.query('SELECT building, SUM(NumberOfBookings) as numOfBookings FROM Room GROUP BY building ORDER BY SUM(NumberOfBookings) DESC LIMIT 5');
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/getEvents', async (req, res) => {
	try {
		const now = new Date();
		const date = now.toISOString().split('T')[0];
		const query = `SELECT * FROM Events WHERE event_date >= '${date}' ORDER BY event_date, start_time`;
		const rows = await db.query(query);
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/deleteEvent', async (req, res) => {
	const { id } = req.query;
	try {
		const query = `DELETE FROM Events WHERE EventID = ${id};`;
		const rows = await db.query(query);
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/getRooms', async (req, res) => {
	const { building } = req.query;
	try {
		const rows = await db.query(`SELECT * FROM Room WHERE building = '${building}'`);
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/getRoomsInfo', async (req, res) => {
	const { building, hour, minute } = req.query;
	try {
		const now = new Date();
		const days = ['M', 'T', 'W', 'R', 'F', 'M', 'M'];
		const day = days[now.getDay() - 1];
		const date = now.toISOString().split('T')[0];
		const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
		const query = `
		SELECT r.building, r.room_number, r.NumberOfBookings
		FROM Room r
		LEFT JOIN (
			SELECT cs.course_building AS building, cs.course_room AS room_number
			FROM Course_Schedule cs
			WHERE cs.course_day LIKE '%${day}%'
			AND '${startTime}' BETWEEN cs.course_start AND cs.course_end
		) AS OccupiedClasses ON r.building = OccupiedClasses.building
		AND r.room_number = OccupiedClasses.room_number
		LEFT JOIN (
			SELECT e.building, e.room_number
			FROM Events e
			WHERE e.event_date = '${date}'
			AND '${startTime}' BETWEEN e.start_time AND e.end_time
		) AS OccupiedEvents ON r.building = OccupiedEvents.building
		AND r.room_number = OccupiedEvents.room_number
		WHERE OccupiedClasses.room_number IS NULL
		AND OccupiedEvents.room_number IS NULL
		AND r.building = '${building}'
		ORDER BY r.room_number
		`;
		const rows = await db.query(query);
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/getRoomsTimePeriod', async (req, res) => {
	const { building } = req.query;
	try {
		const now = new Date();
		const days = ['M', 'T', 'W', 'R', 'F', 'M', 'M'];
		const day = days[now.getDay() - 1];
		const date = now.toISOString().split('T')[0];
		const query = `
        WITH
		HourlySlots AS (
			SELECT
			ADDTIME('08:00', SEC_TO_TIME(seq * 3600)) AS start_time,
			ADDTIME('08:00', SEC_TO_TIME((seq + 1) * 3600)) AS end_time
			FROM (
			SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL 
			SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL 
			SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL 
			SELECT 9 UNION ALL SELECT 10
			) AS Q
		),
		TotalRooms AS (
			SELECT
			COUNT(r.room_number) AS total_room_count
			FROM Room r
			WHERE r.building = '${building}'
			GROUP BY r.building
		),
		OccupiedRooms AS (
			SELECT hs.start_time, hs.end_time,
			COUNT(DISTINCT cs.course_room) AS occupied_room_count
			FROM Course_Schedule cs
			JOIN HourlySlots hs
			ON cs.course_building = '${building}'
			AND cs.course_day LIKE '%${day}%'
			AND cs.course_start < hs.end_time
			AND cs.course_end > hs.start_time
			GROUP BY hs.start_time, hs.end_time
		),
		EventOccupiedRooms AS (
			SELECT hs.start_time, hs.end_time,
			COUNT(DISTINCT e.room_number) AS event_occupied_room_count
			FROM Events e
			JOIN HourlySlots hs
			ON e.building = '${building}'
			AND e.event_date = '${date}'
			AND e.start_time < hs.end_time
			AND e.end_time > hs.start_time
			GROUP BY
			hs.start_time,
			hs.end_time
		)
		SELECT hs.start_time, hs.end_time,
		tr.total_room_count - COALESCE(or1.occupied_room_count, 0) - COALESCE(er.event_occupied_room_count, 0) AS available_room_count
		FROM HourlySlots hs
		CROSS JOIN TotalRooms tr
		LEFT JOIN OccupiedRooms or1
		ON hs.start_time = or1.start_time
		AND hs.end_time = or1.end_time
		LEFT JOIN
		EventOccupiedRooms er
		ON hs.start_time = er.start_time
		AND hs.end_time = er.end_time
		ORDER BY hs.start_time;`;
		const rows = await db.query(query);
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.get('/api/getVacantBuildings', async (req, res) => {
	try {
		const now = new Date();
		const days = ['M', 'T', 'W', 'R', 'F', 'M', 'M'];
		const day = days[now.getDay()];
		const date = now.toISOString().split('T')[0];
		const hour = now.getHours();
		const startTime = `${hour.toString().padStart(2, '0')}:00`;

		const query = `
		WITH OccupiedRooms AS (
			SELECT cs.course_building AS building, cs.course_room AS room_number
			FROM Course_Schedule cs
			WHERE cs.course_day LIKE '%${day}%'
			AND '${startTime}' BETWEEN cs.course_start AND cs.course_end
			UNION
			SELECT e.building, e.room_number
			FROM Events e
			WHERE e.event_date = '${date}'
			AND '${startTime}' BETWEEN e.start_time AND e.end_time
		)
		SELECT r.building, COUNT(r.room_number) AS available_rooms
		FROM Room r
		LEFT JOIN OccupiedRooms o ON r.building = o.building AND r.room_number = o.room_number
		WHERE o.room_number IS NULL
		GROUP BY r.building
		ORDER BY available_rooms DESC
		LIMIT 4;
		`;
		const rows = await db.query(query);
		res.status(200).json(rows);
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to fetch data' });
	}
});

app.post('/api/uploadEvent', async (req, res) => {
	const { EventName, NetId, building, room_number, event_date, event_type, start_time, end_time } = req.body;
	const formattedStartTime = `${start_time}:00`;
	const formattedEndTime = `${end_time}:00`;
	try {
		const maxEventIDQuery = 'SELECT COALESCE(MAX(EventID), 0) AS maxID FROM Events';
        const [rows] = await db.query(maxEventIDQuery);
        const EventID = rows.maxID + 1;

		const query = `
			INSERT INTO Events (EventID, EventName, NetId, building, room_number, event_type, event_date, start_time, end_time)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`;
		await db.query(query, [EventID, EventName, NetId, building, room_number, event_type, event_date, formattedStartTime, formattedEndTime]);
		res.status(201).json({ message: 'Event uploaded successfully' });
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to upload event' });
	}
});

app.post('/api/updateBooking', async (req, res) => {
	const { building, room_number } = req.body;
	try {
		const query = `
			UPDATE Room
			SET NumberOfBookings = NumberOfBookings + 1
			WHERE building = ? AND room_number = ?
		`;
		await db.query(query, [building, room_number]);
		res.status(200).json({ message: 'Booking updated successfully' });
	} catch (err) {
		console.error('Error executing query', err.stack);
		res.status(500).json({ error: 'Failed to update booking' });
	}
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});