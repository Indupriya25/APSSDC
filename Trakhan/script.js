document.addEventListener('DOMContentLoaded', () => {
    const productsSection = document.getElementById('products');
    const orderFormSection = document.getElementById('order-form-section');
    const chooseButtons = document.querySelectorAll('.choose-btn');
    const selectedProductNameElement = document.getElementById('selectedProductName');
    const orderForm = document.getElementById('orderForm');
    const referenceImageUpload = document.getElementById('referenceImageUpload');
    const uploadStatus = document.querySelector('.upload-status');
    const formMessage = document.getElementById('formMessage');
    const submitOrderBtn = document.getElementById('submitOrderBtn');

    let selectedProduct = '';
    let uploadedImageUrl = ''; // To store the S3 URL of the uploaded image

    // --- API Endpoints ---
    // You will get these after deploying your API Gateway and Lambda.
    // Make sure to use the correct region.
    const API_GATEWAY_BASE_URL = 'YOUR_API_GATEWAY_INVOKE_URL'; // e.g., 'https://xxxxxx.execute-api.ap-south-1.amazonaws.com/prod'
    const GET_PRESIGNED_URL_ENDPOINT = `${API_GATEWAY_BASE_URL}/get-presigned-url`; // Example endpoint
    const SUBMIT_ORDER_ENDPOINT = `${API_GATEWAY_BASE_URL}/submit-order`; // Example endpoint

    // --- Product Selection Logic ---
    chooseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const productCard = button.closest('.product-card');
            selectedProduct = productCard.dataset.productName;
            selectedProductNameElement.textContent = selectedProduct;
            productsSection.style.display = 'none';
            orderFormSection.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
        });
    });

    // --- Image Upload Logic (using Pre-signed URLs) ---
    referenceImageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            uploadedImageUrl = '';
            uploadStatus.style.display = 'none';
            uploadStatus.textContent = '';
            return;
        }

        uploadStatus.style.display = 'block';
        uploadStatus.textContent = `Uploading "${file.name}"...`;
        uploadStatus.classList.remove('success', 'error');

        try {
            // 1. Request a pre-signed URL from your Lambda function
            const getUrlResponse = await fetch(GET_PRESIGNED_URL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type
                })
            });

            if (!getUrlResponse.ok) {
                const errorData = await getUrlResponse.json();
                throw new Error(`Failed to get pre-signed URL: ${errorData.message || getUrlResponse.statusText}`);
            }

            const { uploadUrl, fileUrl } = await getUrlResponse.json();
            uploadedImageUrl = fileUrl; // Store the final S3 URL

            // 2. Upload the file directly to S3 using the pre-signed URL
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type,
                },
                body: file,
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload image to S3: ${uploadResponse.statusText}`);
            }

            uploadStatus.textContent = `Image "${file.name}" uploaded successfully!`;
            uploadStatus.classList.add('success');
            console.log('Image uploaded to:', uploadedImageUrl);

        } catch (error) {
            console.error('Image upload error:', error);
            uploadStatus.textContent = `Error uploading image: ${error.message}`;
            uploadStatus.classList.add('error');
            uploadedImageUrl = ''; // Clear URL on failure
            referenceImageUpload.value = ''; // Clear file input
        }
    });

    // --- Form Submission Logic ---
    orderForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        formMessage.style.display = 'none'; // Hide previous messages
        submitOrderBtn.disabled = true; // Disable button to prevent double submission
        submitOrderBtn.textContent = 'Submitting...';

        // Gather all form data
        const customerName = document.getElementById('customerName').value;
        const customerEmail = document.getElementById('customerEmail').value;
        const customerPhone = document.getElementById('customerPhone').value;

        const measurements = {
            chest: document.getElementById('measurement_chest').value,
            waist: document.getElementById('measurement_waist').value,
            hips: document.getElementById('measurement_hips').value,
            shoulder: document.getElementById('measurement_shoulder').value,
            sleeveLength: document.getElementById('measurement_sleeve').value,
            overallLength: document.getElementById('measurement_length').value,
            otherNotes: document.getElementById('measurement_other').value
        };

        const deliveryAddress = {
            line1: document.getElementById('address_line1').value,
            line2: document.getElementById('address_line2').value,
            city: document.getElementById('address_city').value,
            state: document.getElementById('address_state').value,
            zip: document.getElementById('address_zip').value,
            country: document.getElementById('address_country').value
        };

        const orderData = {
            productName: selectedProduct,
            customerName,
            customerEmail,
            customerPhone,
            measurements,
            deliveryAddress,
            referenceImageUrl: uploadedImageUrl // Use the URL obtained from S3 upload
        };

        try {
            const response = await fetch(SUBMIT_ORDER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();

            if (response.ok) {
                formMessage.textContent = result.message || 'Order submitted successfully! We will contact you soon.';
                formMessage.classList.add('success');
                orderForm.reset(); // Clear the form
                selectedProduct = ''; // Reset selected product
                uploadedImageUrl = ''; // Clear uploaded image URL
                uploadStatus.style.display = 'none';
                productsSection.style.display = 'block'; // Show products again
                orderFormSection.style.display = 'none'; // Hide form
            } else {
                formMessage.textContent = result.message || 'Error submitting order. Please try again.';
                formMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Network or API error:', error);
            formMessage.textContent = 'Could not submit order due to a network error. Please check your internet connection.';
            formMessage.classList.add('error');
        } finally {
            formMessage.style.display = 'block';
            submitOrderBtn.disabled = false;
            submitOrderBtn.textContent = 'Submit Order';
        }
    });
});
