import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';

async function testVercel() {
    try {
        const formData = new FormData();
        const dummyAudio = Buffer.from('RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'binary');
        
        formData.append('audio', dummyAudio, {
            filename: 'test.wav',
            contentType: 'audio/wav',
        });

        const res = await fetch("https://backend-five-pied-55.vercel.app/api/transcribe", {
            method: 'POST',
            body: formData,
            // Mock auth token, might fail 401 if requireAuth is strict, but let's test if we get 401 or 500
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error(e);
    }
}

testVercel();
