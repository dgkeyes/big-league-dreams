// Every school that plays NCAA Division I baseball (305 schools for 2027), from Wikipedia's
// "List of NCAA Division I baseball programs". School names only: no logos, mascots, or official colors.
// Each line is "School|State".
const RAW = `
University at Albany|New York
Binghamton University|New York
Bryant University|Rhode Island
University of Maine|Maine
NJIT|New Jersey
UMass Lowell|Massachusetts
UMBC|Maryland
Charlotte|North Carolina
East Carolina University|North Carolina
FAU|Florida
University of Memphis|Tennessee
Rice University|Texas
USF|Florida
Tulane University|Louisiana
UAB|Alabama
UTSA|Texas
Wichita State University|Kansas
Boston College|Massachusetts
Cal (UC Berkeley)|California
Clemson University|South Carolina
Duke University|North Carolina
Florida State University|Florida
Georgia Tech|Georgia
University of Louisville|Kentucky
University of Miami|Florida
North Carolina|North Carolina
NC State|North Carolina
University of Notre Dame|Indiana
Pitt|Pennsylvania
Stanford University|California
University of Virginia|Virginia
Virginia Tech|Virginia
Wake Forest University|North Carolina
Bellarmine University|Kentucky
FGCU|Florida
Jacksonville University|Florida
Lipscomb University|Tennessee
University of North Florida|Florida
Queens University of Charlotte|North Carolina
Stetson University|Florida
Davidson College|North Carolina
University of Dayton|Ohio
Fordham University|New York
George Mason University|Virginia
George Washington University|D.C.
La Salle University|Pennsylvania
University of Rhode Island|Rhode Island
University of Richmond|Virginia
St. Bonaventure University|New York
Saint Joseph's University|Pennsylvania
Saint Louis University|Missouri
VCU|Virginia
Butler University|Indiana
Creighton University|Nebraska
Georgetown University|D.C.
St. John's University|New York
Seton Hall University|New Jersey
UConn|Connecticut
Villanova University|Pennsylvania
Xavier University|Ohio
Charleston Southern University|South Carolina
Gardner-Webb University|North Carolina
High Point University|North Carolina
Longwood University|Virginia
Presbyterian College|South Carolina
Radford University|Virginia
UNC Asheville|North Carolina
USC Upstate|South Carolina
Winthrop University|South Carolina
University of Illinois|Illinois
Indiana University|Indiana
University of Iowa|Iowa
University of Maryland|Maryland
University of Michigan|Michigan
Michigan State University|Michigan
University of Minnesota|Minnesota
University of Nebraska|Nebraska
Northwestern University|Illinois
Ohio State University|Ohio
University of Oregon|Oregon
Penn State|Pennsylvania
Purdue University|Indiana
Rutgers University|New Jersey
UCLA|California
USC|California
University of Washington|Washington
University of Arizona|Arizona
Arizona State University|Arizona
Baylor University|Texas
BYU|Utah
University of Cincinnati|Ohio
University of Houston|Texas
University of Kansas|Kansas
Kansas State University|Kansas
Oklahoma State University|Oklahoma
TCU|Texas
Texas Tech University|Texas
UCF|Florida
University of Utah|Utah
West Virginia University|West Virginia
California Baptist University|California
Cal Poly|California
Cal State Fullerton|California
CSUN|California
Cal State Bakersfield|California
Long Beach State|California
Sacramento State|California
UC Irvine|California
UC Riverside|California
UC San Diego|California
UC Santa Barbara|California
Utah Valley University|Utah
Campbell University|North Carolina
College of Charleston|South Carolina
Elon University|North Carolina
Hofstra University|New York
Monmouth University|New Jersey
North Carolina A&T|North Carolina
Northeastern University|Massachusetts
Stony Brook University|New York
Towson University|Maryland
UNC Wilmington|North Carolina
College of William & Mary|Virginia
University of Delaware|Delaware
FIU|Florida
Jacksonville State University|Alabama
Kennesaw State University|Georgia
Liberty University|Virginia
Middle Tennessee|Tennessee
Missouri State University|Missouri
New Mexico State University|New Mexico
Sam Houston|Texas
WKU|Kentucky
Milwaukee|Wisconsin
NIU|Illinois
Northern Kentucky University|Kentucky
Oakland University|Michigan
Wright State University|Ohio
Youngstown State University|Ohio
Brown University|Rhode Island
Columbia University|New York
Cornell University|New York
Dartmouth College|New Hampshire
Harvard University|Massachusetts
Penn|Pennsylvania
Princeton University|New Jersey
Yale University|Connecticut
Canisius University|New York
Fairfield University|Connecticut
Iona University|New York
Manhattan University|New York
Marist University|New York
Merrimack College|Massachusetts
Mount St. Mary's University|Maryland
Niagara University|New York
Quinnipiac University|Connecticut
Rider University|New Jersey
Sacred Heart University|Connecticut
Saint Peter's University|New Jersey
Siena University|New York
University of Akron|Ohio
Ball State University|Indiana
Bowling Green|Ohio
Central Michigan University|Michigan
Eastern Michigan University|Michigan
Kent State University|Ohio
UMass|Massachusetts
Miami (Ohio)|Ohio
Ohio University|Ohio
University of Toledo|Ohio
Western Michigan University|Michigan
Belmont University|Tennessee
Bradley University|Illinois
University of Evansville|Indiana
Illinois State University|Illinois
Indiana State University|Indiana
Murray State University|Kentucky
Southern Illinois|Illinois
UIC|Illinois
Valparaiso University|Indiana
Air Force|Colorado
Grand Canyon University|Arizona
Hawaii|Hawaii
University of Nevada|Nevada
University of New Mexico|New Mexico
San Jose State University|California
UC Davis|California
UNLV|Nevada
Utah Tech University|Utah
Central Connecticut|Connecticut
Coppin State University|Maryland
Delaware State University|Delaware
Fairleigh Dickinson University|New Jersey
Le Moyne College|New York
LIU|New York
UMES|Maryland
Norfolk State University|Virginia
Stonehill College|Massachusetts
Wagner College|New York
Eastern Illinois University|Illinois
Lindenwood University|Missouri
Morehead State University|Kentucky
Southeast Missouri|Missouri
SIU Edwardsville|Illinois
University of Southern Indiana|Indiana
UT Martin|Tennessee
Western Illinois University|Illinois
Dallas Baptist University|Texas
Fresno State|California
Gonzaga University|Washington
Oregon State University|Oregon
San Diego State University|California
Texas State University|Texas
Washington State University|Washington
Army West Point|New York
Bucknell University|Pennsylvania
College of the Holy Cross|Massachusetts
Lafayette College|Pennsylvania
Lehigh University|Pennsylvania
Navy|Maryland
University of Alabama|Alabama
University of Arkansas|Arkansas
Auburn University|Alabama
University of Florida|Florida
University of Georgia|Georgia
University of Kentucky|Kentucky
LSU|Louisiana
Ole Miss|Mississippi
Mississippi State University|Mississippi
Missouri|Missouri
University of Oklahoma|Oklahoma
University of South Carolina|South Carolina
University of Tennessee|Tennessee
University of Texas|Texas
Texas A&M|Texas
Vanderbilt University|Tennessee
The Citadel|South Carolina
ETSU|Tennessee
Mercer University|Georgia
Samford University|Alabama
Tennessee Tech University|Tennessee
UNC Greensboro|North Carolina
VMI|Virginia
Western Carolina University|North Carolina
Wofford College|South Carolina
Houston Christian University|Texas
Incarnate Word|Texas
Lamar University|Texas
LSU New Orleans|Louisiana
McNeese|Louisiana
Nicholls|Louisiana
Northwestern State University|Louisiana
Southeastern Louisiana University|Louisiana
Stephen F. Austin|Texas
Texas A&M University-Corpus Christi|Texas
UTRGV|Texas
Alabama A&M University|Alabama
Alabama State University|Alabama
Alcorn State University|Mississippi
Arkansas-Pine Bluff|Arkansas
Bethune-Cookman University|Florida
Florida A&M|Florida
Grambling State University|Louisiana
Jackson State University|Mississippi
Mississippi Valley State University|Mississippi
Prairie View A&M University|Texas
Southern University|Louisiana
Texas Southern University|Texas
North Dakota State University|North Dakota
University of Northern Colorado|Colorado
Nebraska Omaha|Nebraska
Oral Roberts University|Oklahoma
University of St. Thomas|Minnesota
South Dakota State University|South Dakota
Appalachian State University|North Carolina
Arkansas State University|Arkansas
Coastal Carolina University|South Carolina
Georgia Southern University|Georgia
Georgia State University|Georgia
James Madison University|Virginia
Louisiana (Lafayette)|Louisiana
Louisiana-Monroe|Louisiana
Louisiana Tech University|Louisiana
Marshall University|West Virginia
Old Dominion University|Virginia
University of South Alabama|Alabama
Southern Miss|Mississippi
Troy University|Alabama
Abilene Christian University|Texas
Austin Peay|Tennessee
University of Central Arkansas|Arkansas
EKU|Kentucky
Little Rock|Arkansas
University of North Alabama|Alabama
Tarleton State University|Texas
UT Arlington|Texas
Loyola Marymount|California
University of the Pacific|California
Pepperdine University|California
University of Portland|Oregon
Saint Mary's|California
University of San Diego|California
University of San Francisco|California
Santa Clara University|California
Seattle University|Washington
`;

export const COLLEGES = RAW.trim()
  .split('\n')
  .map((l) => {
    const [name, state] = l.split('|');
    return { name, state };
  })
  .sort((a, b) => a.name.replace(/^(The |University of |College of )/, '').localeCompare(b.name.replace(/^(The |University of |College of )/, '')));
