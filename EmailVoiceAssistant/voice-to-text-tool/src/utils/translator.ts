import axios from 'axios';

const translatorKey = process.env.AZURE_TRANSLATOR_KEY;
const translatorRegion = process.env.AZURE_TRANSLATOR_REGION || 'eastus';

if (!translatorKey) {
    throw new Error('AZURE_TRANSLATOR_KEY environment variable is not set');
}

const endpoint = 'https://api.cognitive.microsofttranslator.com';

export async function translateToChinese(text: string): Promise<string> {
    try {
        const response = await axios.post(
            `${endpoint}/translate`,
            [{ Text: text }],
            {
                params: {
                    'api-version': '3.0',
                    from: 'en',
                    to: 'zh-Hans'  // Simplified Chinese
                },
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': translatorRegion,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data[0].translations[0].text;
    } catch (err) {
        console.error('Translation error:', err);
        throw new Error('Failed to translate text');
    }
}
