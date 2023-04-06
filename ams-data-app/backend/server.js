const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http').Server(app);
const { CloudEvent, HTTP } = require('cloudevents');
const io = require('socket.io')(http, {
  cors: {
    origin: '*'
  }
});

const KnativeEventingBrokerUri = process.env.BROKER_URI || 'http://broker-ingress.knative-eventing.svc.cluster.local/demo/default';

// Example weather data
let weatherData = {
  coordinates: {
    latitude: 52.370216,
    longitude: 4.895168,
  },
  current_weather: {
    temperature: 20,
    windspeed: 10,
    weathercode: 'Sunny',
    time: '12:00 PM',
  },
};

// Example scooter data
let scooterData = {
  coordinates: {
    latitude: 52.370216,
    longitude: 4.895168
  },
  scooters: [
    {
      id: 1,
      scooterId: "scooter-1",
      geometry: {
        type: "Point",
        coordinates: [4.895168, 52.370216]
      },
      operator: "Operator 1",
      availabilityStatus: true,
      name: "Scooter 1",
      maxSpeed: 25,
      currentLocation: "Amsterdam",
      licensePlate: "ABC123",
      numberOfAvailableHelmets: 2,
      distance: 0.5
    },
    {
      id: 2,
      scooterId: "scooter-2",
      geometry: {
        type: "Point",
        coordinates: [4.8746, 52.369553]
      },
      operator: "Operator 2",
      availabilityStatus: false,
      name: "Scooter 2",
      maxSpeed: 20,
      currentLocation: "Amsterdam",
      licensePlate: "XYZ789",
      numberOfAvailableHelmets: 0,
      distance: 1.2
    }
  ]
};

app.use(cors({
  origin: '*'
}));
app.options('*', cors()); // Enable pre-flight requests for all routes

app.use(express.json());

// API endpoint for receiving weather data
app.post('/weather', (req, res) => {
  // Parse the weather data from the request
  const incomingWeatherData = req.body;

  // Only update the weather data if the incoming data is valid
  if (incomingWeatherData && typeof incomingWeatherData === 'object') {
    weatherData = incomingWeatherData;

    // Emit a 'weatherData' event to all connected clients
    io.emit('weatherData', weatherData);

    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

// API endpoint for receiving scooter data
app.post('/scooters', (req, res) => {
  // Parse the scooter data from the request
  const incomingScooterData = req.body;

  // Only update the scooter data if the incoming data is valid
  if (incomingScooterData && typeof incomingScooterData === 'object') {
    scooterData = incomingScooterData;

    // Emit a 'scooterData' event to all connected clients
    io.emit('scooterData', scooterData);

    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

// Serve the client build folder
app.use(express.static('client/build'));

// Catch-all route for serving the client app
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/client/build/index.html');
});

// Receive coordinates event
io.on('connection', (socket) => {
  socket.on('coordinates', ({ lat, lng }) => {
    console.log(`Received coordinates: ${lat}, ${lng}`);

    // Create a CloudEvent with the latitude and longitude data
    const ce = new CloudEvent({
      type: 'coordinates',
      source: 'ams-data-app',
      data: {
        latitude: lat,
        longitude: lng
      }
    });

    // Create the HTTP Transport binding and set the target URL
    const transport = new HTTP({
      url: KnativeEventingBrokerUri
    });

    // Emit the CloudEvent to the target URL
    transport.send(ce)
      .then(response => {
        console.log(`CloudEvent emitted with status code: ${response.statusCode}`);
      })
      .catch(error => {
        console.error('Error sending CloudEvent:', error);
      });
  });
});

// Start the server
const port = process.env.PORT || 3333;
http.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
