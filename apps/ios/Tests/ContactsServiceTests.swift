import Contacts
import Testing
@testable import OpenClaw

@Suite(.serialized) struct ContactsServiceTests {
    @Test func matchesPhoneOrEmailForDedupe() {
        let contact = CNMutableContact()
        contact.givenName = "Test"
        contact.phoneNumbers = [
            CNLabeledValue(label: CNLabelPhoneNumberMobile, value: CNPhoneNumber(stringValue: "+1 (555) 000-0000")),
        ]
        contact.emailAddresses = [
            CNLabeledValue(label: CNLabelHome, value: "[redacted-email]" as NSString),
        ]

        #expect(ContactsService._test_matches(contact: contact, phoneNumbers: ["15550000000"], emails: []))
        #expect(ContactsService._test_matches(contact: contact, phoneNumbers: [], emails: ["[redacted-email]"]))
        #expect(!ContactsService._test_matches(contact: contact, phoneNumbers: ["999"], emails: ["[redacted-email]"]))
    }
}
