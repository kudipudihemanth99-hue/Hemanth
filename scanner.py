import phonenumbers
import urllib.parse
from phonenumbers import geocoder, carrier, timezone

def analyze_phone_number():
    print("--- Phone Number OSINT Tool v2 ---")
    raw_number = input("Enter a phone number with country code (e.g., +15551234567): ")
    
    try:
        parsed_number = phonenumbers.parse(raw_number)
        
        if phonenumbers.is_valid_number(parsed_number):
            region = geocoder.description_for_number(parsed_number, "en")
            service_provider = carrier.name_for_number(parsed_number, "en")
            
            print("\n--- 1. Telecom Routing Data ---")
            print(f"Country/Region: {region}")
            print(f"Carrier/Network: {service_provider}")
            
            # Generate different formats of the number for searching
            e164 = phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.E164)
            national = phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.NATIONAL)
            
            print("\n--- 2. Public Footprint (Google Dorks) ---")
            print("Copy and paste these URLs into your browser to search the web for this number:")
            
            # Create specific search queries
            queries = [
                f'"{e164}" OR "{national}"',
                f'site:facebook.com "{national}" OR "{e164}"',
                f'site:twitter.com "{national}" OR "{e164}"',
                f'site:pastebin.com "{e164}"'
            ]
            
            for query in queries:
                encoded_query = urllib.parse.quote(query)
                print(f"- https://www.google.com/search?q={encoded_query}")
                
        else:
            print("Status: INVALID NUMBER FORMAT")
            
    except phonenumbers.phonenumberutil.NumberParseException:
        print("\nError: Please make sure you include the '+' and the country code.")

if __name__ == "__main__":
    analyze_phone_number()
