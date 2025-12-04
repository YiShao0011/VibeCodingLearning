# Voice to Text Tool

## Overview
The Voice to Text Tool is a simple application that converts voice input from a microphone into a text file. It utilizes speech recognition technology to capture audio data and processes it to generate text output.

## Features
- Real-time voice recognition
- Saves recognized text to a specified text file
- Easy to use interface for starting and stopping the microphone input

## Project Structure
```
voice-to-text-tool
├── src
│   ├── main.ts               # Entry point of the application
│   ├── microphone
│   │   └── index.ts          # Handles microphone input
│   ├── speech
│   │   └── recognizer.ts      # Processes audio data for speech recognition
│   └── utils
│       └── fileWriter.ts      # Utility for writing text to a file
├── package.json               # npm configuration file
├── tsconfig.json              # TypeScript configuration file
└── README.md                  # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd voice-to-text-tool
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage
1. Run the application:
   ```
   npm start
   ```
2. Follow the prompts to start listening to your voice input.
3. Once you finish speaking, the recognized text will be saved to a specified text file.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License
This project is licensed under the MIT License.