# Evercare Prescription Doc

Build a standalone, fully functional web application called **EVERCARE Prescription Extractor**. This application will later be integrated as a feature inside a larger medication management project named EVERCARE.

## 1. Core Purpose

The ONLY purpose of this application is to extract all readable text from a medical prescription and identify the medicine-related information in a structured format.

Do not build a full medication management application.

## 2. Required UI

Create a clean, professional, responsive medical application interface with:

* App title: EVERCARE Prescription Extractor

* Upload Prescription button

* Scan Prescription button using the device camera

* Support for JPG, JPEG, PNG and PDF files

* Image preview before processing

* Remove and replace uploaded files

* Extract Prescription Details button

* Loading indicator during extraction

* Clear error messages and retry option

* Results section displaying extracted medicine details

* A separate section showing the complete raw OCR text

* A Copy Results button

* A Reset button

Do not add login, registration, user profiles, a main dashboard, medicine reminders, alarms, a medicine database, or unrelated features.

## 3. Prescription Processing Workflow

Implement this complete workflow:

1. Accept an uploaded prescription image, PDF, or camera capture.

2. Validate the file type and size.

3. Preprocess the image when needed to improve readability.

4. Extract all readable text using an OCR or suitable prescription-reading service.

5. Preserve the complete extracted text in a raw_text field.

6. Use the Gemini API to identify medicine-related information from the extracted text.

7. Return the extracted details as structured JSON.

8. Display every detected medicine separately.

9. Show missing, ambiguous, or uncertain fields as Unknown or Needs Review.

10. Never invent medicine names, dosages, quantities, frequencies, timings, or durations.

11. Allow the user to review the results and see the original prescription.

12. Display a useful error if the prescription cannot be read or the API fails.

## 4. Required Medicine Fields

For every detected medicine, extract:

* medicine_name

* brand_name, if available

* generic_name, if explicitly identifiable

* dosage

* dosage_unit, such as mg, mcg, ml or drops

* quantity_per_dose, if stated

* route_of_administration, if stated

* frequency

* prescribed_times, if explicitly stated

* duration

* total_quantity, if stated

* special_instructions

* source_text

* confidence_or_review_status

* missing_fields

Keep the distinction between dosage, quantity per dose, frequency, duration, and total quantity. Do not treat these as interchangeable.

Preserve the original wording wherever possible. Do not infer a schedule from incomplete instructions.

## 5. Gemini Integration

Integrate the Gemini API through a secure server-side endpoint.

Use a supported Gemini model and structured JSON output. Keep the API key in a server-side environment variable. Never expose API keys in frontend code, source maps, or client network responses.

The extraction system must return both:

* raw_text: all readable prescription text

* medicines: an array containing the medicine details listed above

Also identify prescription-level details such as the prescription date, patient name, and prescriber details when present, but do not require them.

The medicine parser must distinguish actual medicines from headings, addresses, doctor details, diagnosis, test results, and general notes.

If the OCR output is incomplete or unclear, do not silently fill the gaps using AI guesses.

## 6. Output Contract

Create a reusable, documented extraction function that accepts a prescription file and returns a predictable JSON object.

Example structure:

{

"success": true,

"raw_text": "Original extracted prescription text",

"medicines": [

{

"medicine_name": "Example Medicine",

"dosage": "5",

"dosage_unit": "ml",

"quantity_per_dose": "5 ml",

"frequency": "As written on prescription",

"prescribed_times": [],

"duration": "As written on prescription",

"total_quantity": null,

"special_instructions": null,

"source_text": "Matching prescription text",

"confidence_or_review_status": "needs_review",

"missing_fields": []

}

],

"warnings": []

}

This is an illustrative schema only. Never use the example medicine as a real extracted result.

Use null or an explicit review status for missing information. Validate API output before displaying it.

## 7. Integration-Ready Architecture

Build the application so that it can later be integrated into a separate React-based application.

Requirements:

* Separate UI components, OCR processing, Gemini parsing, API client, and type definitions.

* Create a reusable function such as extractPrescription(file).

* Keep API calls out of presentation components.

* Use a documented, stable JSON response contract.

* Provide an integration guide explaining the required dependencies, environment variables, API endpoint, request format, response format, and error handling.

* Keep all processing logic independent of the UI.

* Do not require Lovable-specific runtime services for the core extraction workflow.

* Do not introduce Supabase, authentication, persistent user storage, or other backend dependencies unless absolutely required.

* If a server-side function is needed, provide its complete source code and setup instructions.

## 8. Error Handling and Privacy

Handle invalid files, oversized files, unsupported formats, unreadable prescriptions, malformed JSON, network errors, rate limits, and API failures.

Do not permanently store uploaded prescriptions. Process files temporarily and release them after processing. Do not log prescription contents, patient information, or API secrets.

## 9. Quality Requirements

* No fake OCR or hardcoded extraction results.

* No mock API calls presented as real functionality.

* No buttons that do nothing.

* Use clear loading, success, empty, and error states.

* Ensure the actual extraction works with real uploaded files.

* Make the UI usable on desktop and mobile.

* Provide sample test cases for printed, handwritten, blurry, incomplete, and multi-medicine prescriptions.

* Document known OCR limitations.

## 10. Final Deliverables

Before finishing, verify that the application builds successfully and that the real extraction workflow is connected.

Provide:

1. Complete source code.

2. Working upload and camera interfaces.

3. Real OCR and Gemini integration.

4. Example validated JSON output.

5. Environment variable setup instructions.

6. Local installation and run instructions.

7. A step-by-step guide for integrating this module into the main EVERCARE project.

Prioritize a working, portable extraction module over unnecessary features.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eb7c0e6a-f598-5f8e-a2b9-bfce37cb457b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
