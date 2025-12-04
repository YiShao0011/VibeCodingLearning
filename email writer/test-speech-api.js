import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
const key = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';

console.log('Testing Whisper via Cognitive Services Speech Endpoint');
console.log('=======================================================');
console.log('Endpoint:', endpoint);
console.log('Deployment:', deployment);
console.log('');

async function testCognitiveServicesSpeech() {
  try {
    // Extract resource name from endpoint (e.g., https://oaiyi.openai.azure.com -> oaiyi)
    const resourceName = endpoint.split('//')[1]?.split('.')[0];
    
    // Cognitive Services Speech endpoint pattern
    const speechEndpoint = `https://${resourceName}.cognitiveservices.azure.com`;
    const speechUrl = `${speechEndpoint}/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

    console.log('Testing Cognitive Services Speech endpoint:');
    console.log('Speech Endpoint:', speechEndpoint);
    console.log('Speech URL:', speechUrl);
    console.log('');

    // Create a minimal audio buffer (silence)
    const audioBuffer = Buffer.alloc(100);

    const response = await fetch(speechUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav'
      },
      body: audioBuffer
    });

    console.log('Response Status:', response.status);
    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (response.status === 400 || response.status === 400) {
      // 400 might mean bad audio format but the endpoint exists
      console.log('\n✓ Speech endpoint responded (bad audio is OK, means endpoint exists)');
    } else if (response.ok) {
      console.log('\n✓ Speech endpoint working!');
    } else {
      console.log('\n✗ Speech endpoint error.');
    }
  } catch (err) {
    console.error('✗ ERROR:', err.message);
  }

  console.log('\n---\n');

  // Also try Azure Speech-to-Text REST endpoint directly
  try {
    const speechEndpoint = endpoint.replace('openai.azure.com', 'cognitiveservices.azure.com');
    const speechUrl = `${speechEndpoint}/speech/synthesize?api-version=2024-08-01`;

    console.log('Testing alternative Cognitive Services endpoint:');
    console.log('URL:', speechUrl);
    console.log('');

    const response = await fetch(speechUrl, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': key
      }
    });

    console.log('Response Status:', response.status);
    const responseText = await response.text();
    console.log('Response (first 200 chars):', responseText.substring(0, 200));
  } catch (err) {
    console.error('✗ ERROR:', err.message);
  }
}

testCognitiveServicesSpeech();
