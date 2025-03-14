import express from 'express';
import dotenv from 'dotenv';
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const port = 3077;

// Setup for Threads API
// https://developers.facebook.com/apps/1925707704842761/use_cases/customize/?use_case_enum=THREADS_API&selected_tab=settings&product_route=threads-api

// Get tokens
// https://threads.net/oauth/authorize?client_id=665546982608599&redirect_uri=https://socialsizzle.herokuapp.com/auth/&scope=threads_basic,threads_content_publish&response_type=code
// https://threads.net/oauth/authorize?client_id=665546982608599&redirect_uri=https://socialsizzle.herokuapp.com/auth/&scope=threads_search,threads_publish&response_type=code
// Tons of issues trying to get the base API going, so skipping for now.

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public')); // Serve static files from the 'public' directory
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.listen(port, () => {
  console.log("Server started at http://localhost:" + port);
});

// Home Route (Default / Main Page) - This is what you were asking for
app.get('/', (req, res) => {
  console.log("Loading main page now...");

  // Option 2: Send an HTML file (more common)
  res.sendFile(__dirname + '/public/index.html'); // Assuming you have an index.html in a 'public' folder
});


// Gemini Tool insert exercise rep.
app.post('/exerciseReps', async (req, res) => {
  console.log("DEBUG1: Gemini Tool insert version");
  // console.log("DEBUG1: Received request:", req.body);
  const { username, exerciseText } = req.body;

  try {
    const response = await insertExerciseRepGemini(username, exerciseText);
    res.status(201).json({ message: response });
  } catch (error) {
    console.error("Error inserting exercise record:", error);
    res.status(500).json({ error: 'Failed to create exercise record' });
  }
});

// Sample for SMS sending.
app.get('/exampleSMS', async (req, res) => {
  try {
    // const response = await chain.call({ product: "widgets" });
    const response = await sendSMS('5127092825', 'Hello World falazar 3 via email.');

    res.json({ message: 'ok' });
  } catch (error) {
    console.error("Error processing SMS request:", error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Sample for test loading thoughts.
app.get('/thinkTest', async (req, res) => {
  try {
    const response = await thinkLoadFile();

    res.json({ message: response });
  } catch (error) {
    console.error("Error processing SMS request:", error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Gemini Tool "think" action for an AI.
app.get('/think', async (req, res) => {
  console.log("DEBUG1: Gemini Tool think version");
  // const { username, exerciseText } = req.body;

  try {
    const response = await thinkMethod();

    res.status(201).json({ message: response });
  } catch (error) {
    console.error("Error calling think method:", error);
    res.status(500).json({ error: 'Failed to call think method' });
  }
});

// Insert a new exercise repetition using Gemini 2.0 Functions.
async function insertExerciseRepGemini(username: string, exerciseText: string) {
  console.log("DEBUG3: GoogleGenerativeAI imported");
  // Access your API key as an environment variable (see "Set up your API key" above)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // STEP 1: Declare our functions inside our model now.
  const generativeModel = genAI.getGenerativeModel({
    // Use a model that supports function calling, like a Gemini 1.5 model
    model: "gemini-2.0-flash",
    // Specify the function declaration.
    tools: {
      functionDeclarations: [insertExerciseRepFunctionDeclaration],
    },
  });
  console.log("DEBUG4: generativeModel created");

  // STEP 2: Start our chat and check to call our function.
  console.log("DEBUG4: STEP 2: Starting chat. ");
  const chat = generativeModel.startChat();
  // const prompt = `Username is Robin. Today is ${ new Date().toISOString() }  I just completed 30 mins swimming.`;
  // Build up the full prompt we send to gemini. This is the input to the model.
  const prompt = `Username is ${username}. Today is ${new Date().toISOString()}  Exercise Text: ${exerciseText}`;
  console.log("DEBUG4: Generated prompt:", prompt);
  // Send the message to the model.
  const result = await chat.sendMessage(prompt);
  console.log("DEBUG4: Received response:", result.response.text());

  // STEP 3: Call function if needed.
  console.log("DEBUG5: STEP 3: Call function if needed.");
  // For simplicity, this uses the first function call found.
  const call = result.response.functionCalls()[0];
  if (call) {
    console.log("DEBUG5: Received function call:", call);
    // Call the executable function named in the function call
    // with the arguments specified in the function call.
    // @ts-ignore
    const apiResponse = await functions[call.name](call.args);

    // STEP 4: Send the API response back to the model so it can generate
    // a text response that can be displayed to the user.
    const result2 = await chat.sendMessage([{
      functionResponse: {
        name: 'insertExerciseRep',
        response: apiResponse
      }
    }]);
    // Log the text response.
    const responseText = result2.response.text();
    console.log("DEBUG6: Response text:", responseText);
    return responseText;
  } else {
    console.log("DEBUG6: No function call found. exiting.");
    // else error.
    throw new Error("No function call found in response.");
  }
}

// Executable function code. Put it in a map keyed by the function name
// so that you can call it once you get the name string from the model.
const functions = {
  insertExerciseRep: ({ username, exerciseName, quantity, quantityType, timeDone }: {
    username: string,
    exerciseName: string,
    quantity: number,
    quantityType: string,
    timeDone: string
  }) => {
    return insertExerciseRep(username, exerciseName, quantity, quantityType, timeDone);
  },
  thinkLoadFile: () => {
    return thinkLoadFile();
  }
};

// Declare our methods here with some helpful descriptions.
const insertExerciseRepFunctionDeclaration = {
  name: "insertExerciseRep",
  parameters: {
    type: "OBJECT",
    description: "Insert an exercise repetition record into the database.",
    properties: {
      username: {
        type: "STRING",
        description: "The name of the user performing the exercise.",
      },
      exerciseName: {
        type: "STRING",
        description: "The name of the exercise being performed.",
      },
      quantity: {
        type: "NUMBER",
        description: "The number of repetitions performed, repetitions or minutes, if hours convert to minutes.",
      },
      quantityType: {
        type: "STRING",
        description: "The type for the quantity, generally either 'reps' or 'minutes' or 'laps' or 'miles'. ",
      },
      timeDone: {
        type: "STRING",
        description: "The time when the exercise was performed. Date and time format. If no date given, use today, if no time given use current time. ",
      },
    },
    required: ["username", "exerciseName", "quantity", "timeDone"],
  },
}
const thinkLoadFileFunctionDeclaration = {
  name: "thinkLoadFile",
  parameters: {
    type: "OBJECT",
    description: "Load a file of thoughts to think about.",
    properties: {
      dummyProperty: {
        type: "STRING",
        description: "A dummy property to satisfy the non-empty requirement."
      }
    },
    required: ["dummyProperty"],
  },
}

async function insertExerciseRep(username: string, exerciseName: string, quantity: number, quantityType: string, timeDone: string) {
  // const db = await getDb();
  // const result = await db.run(
  //   'INSERT INTO exerciseReps (userName, exerciseName, quantity, quantityType, timeDone) VALUES (?, ?, ?, ?, ?)',
  //   [username, exerciseName, quantity, quantityType, timeDone]
  // );
  console.log('SQL Exercise record created.');
}

// think start point method, can call the gemini tool function.
async function thinkMethod() {
  // When think is called the AI knows to call think stored method and load a file from the data dir.

  console.log("DEBUG3: think method started. ");

  // Access your API key as an environment variable (see "Set up your API key" above)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // STEP 1: Declare our functions inside our model now.
  const generativeModel = genAI.getGenerativeModel({
    // Use a model that supports function calling, like a Gemini 1.5 model
    model: "gemini-2.0-flash",
    // Specify the function declaration.
    tools: {
      functionDeclarations: [thinkLoadFileFunctionDeclaration],
    },
  });
  console.log("DEBUG4: generativeModel created");

  // STEP 2: Start our chat and check to call our function.
  console.log("DEBUG5: STEP 2: Starting chat. ");
  const chat = generativeModel.startChat();
  // const prompt = `Username is Robin. Today is ${ new Date().toISOString() }  I just completed 30 mins swimming.`;
  // Build up the full prompt we send to gemini. This is the input to the model.
  const prompt = `I have some downtime, lets load some thoughts to think about.`;
  console.log("DEBUG6: Generated prompt:", prompt);
  // Send the message to the model.
  const result = await chat.sendMessage(prompt);
  console.log("DEBUG7: Received response:", result.response.text());

  // STEP 3: Call function if needed.
  console.log("DEBUG8: STEP 3: Call function if needed.");
  // For simplicity, this uses the first function call found.
  const call = result.response.functionCalls()[0];
  if (call) {
    console.log("DEBUG9: Received want to call function:", call);
    // Call the executable function named in the function call
    // with the arguments specified in the function call.
    // @ts-ignore
    const apiResponse = await functions[call.name](call.args);
    console.log("DEBUG9: API response:", apiResponse);
    // How to convert to internal thoughts and usage of *I* instead?
    const prompt2 = "Act as an intelligent person with a wide range of interests.  You will pick a random new topic from this list and give a one paragraph response on what you think about it: "
    const fullPrompt = `${prompt2} ${apiResponse.thoughts}`;
    console.log("DEBUG9: Full prompt:", fullPrompt);

    // STEP 4: Send the API response back to the model so it can generate
    // a text response that can be displayed to the user.
    const result2 = await chat.sendMessage(fullPrompt);

    // Debug whole response in case of weirdness or errors.
    console.log("DEBUG10: Full response:", result2);

    // Log the text response.
    const responseText = result2.response.text();
    console.log("DEBUG10: Response text:", responseText);
    return responseText;
  } else {
    console.log("DEBUG11: No function call found. exiting.");
    // else error.
    throw new Error("No function call found in response.");
  }
}


// Example for SMS sending.
async function sendSMS(toNumber: string, message: string) {
  // Create a transporter object using SMTP transport
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'falazar23@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  // Define the email options
  const mailOptions = {
    from: 'falazar23@gmail.com',
    to: '5127092825@tmomail.net',
    // to: `${toNumber}@tmomail.net`,
    subject: 'Workout Reminder3',
    // text: 'This is a test message sent to a Sprint phone number via email.',
    text: message
  };

  // Send the message
  transporter.sendMail(mailOptions, (error: any, info: { response: string; }) => {
    if (error) {
      return console.log(error);
    }
    console.log('SMS Message sent: ' + info.response);
  });

  return true;
}

// Return back a json with a string of thought topics.
async function thinkLoadFile(): Promise<{ thoughts: string }> {
  const filename = 'data/thought_words.txt';
  const fs = require('fs');
  let thoughts = fs.readFileSync(filename, 'utf8');
  // shuffle all topics:
  thoughts = thoughts.split('\n').sort(() => Math.random() - 0.5).join('\n');
  // replace \n with commas
  thoughts = thoughts.replace(/\n/g, ', ');
  console.log("Thoughts loaded:", thoughts);

  // grab first thought only.
  const thought = thoughts.split(', ')[0];
  // Not as good at choosing random ones if I send whole file... hmm.

  // Ensure the response is a valid JSON object
  return { thoughts: thought };
  // return { thoughts: thoughts };
}

// TODO make generic load file method and give to AI.

