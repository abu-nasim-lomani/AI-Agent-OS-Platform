"""Test fixture generator — known-content PDF for RAG golden-path verification.

চালানো:  uv run --with reportlab python test-fixtures/make-electronics-faq.py
আউটপুট:   test-fixtures/electronics-faq.pdf  (gitignored — generated artifact)

Content জানা, তাই grounded প্রশ্নের উত্তর যাচাই করা যায় (delivery charge, price, policy)
এবং out-of-knowledge প্রশ্নে UNKNOWN প্রত্যাশিত (docs/11 eval categories-এর ছোট রূপ)।
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

LINES = [
    "ABC Electronics — Delivery & Return Policy",
    "",
    "Delivery charge inside Dhaka is 60 taka.",
    "Delivery charge outside Dhaka is 120 taka.",
    "Cash on delivery (COD) is available everywhere.",
    "",
    "Return policy: products can be returned within 7 days of delivery.",
    "Warranty: Samsung phones carry a 1 year official warranty.",
    "",
    "Price list:",
    "Samsung A54 price is 42000 taka.",
    "Samsung A34 price is 35000 taka.",
]

if __name__ == "__main__":
    c = canvas.Canvas("test-fixtures/electronics-faq.pdf", pagesize=A4)
    y = 800
    for line in LINES:
        c.drawString(60, y, line)
        y -= 24
    c.showPage()
    c.save()
    print("wrote test-fixtures/electronics-faq.pdf")
