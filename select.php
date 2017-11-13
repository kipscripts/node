<?php

$cstyle = $temperature = $fishing = $dinner = $lunch = $bfast = $ingredient = $item = $details = "";

# multiline variable to hold html header info
$header = '<!doctype html>

<html lang="en">
<head>
    <meta charset="utf-8">

    <title>Camping Loadout Builder</title>
    <meta name="description" content="Gear and Meal Options based on Camping style and Temperature expectations">
    <meta name="author" content="Kip Turk">

    <link rel="stylesheet" href="css/lnf.css">

    <!--[if lt IE 9]>
        <script src="https://cdnjscloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.js"></script>
    <![endif]-->
</head>

<body>';

$footer = '</body></html>';


if ($_SERVER['REQUEST_METHOD'] == "POST")   {
    $cstyle = test_input($_POST['cstyle']);
    $bfast = test_input($_POST['bfast']);
    $lunch = test_input($_POST['lunch']);
    $dinner = test_input($_POST['dinner']);
    $fishing = test_input($_POST['fishing']);
    $temperature = test_input($_POST['temperature']);

    print $header;
    print '<h1 style="color:navy;margin-left:3%;">Camping Loadout and Meals</h1>';
    print '<fieldset><legend>Meals</legend>';
    $conn = pg_connect("host=aws-db dbname=recipes user=kipt password=B8h.v33n") or die(print "<font size='3' color='red'>Could not connect to database.</font>");
    $result = pg_prepare($conn, 'my_query', 'select name, meal, style, food, home, trail from recipes where style = $1 and tsv @@ $2');
    foreach ($_POST['ingredient'] as &$item) {
        $result = pg_execute($conn, 'my_query', array($cstyle, $item));
        $arr = pg_fetch_all($result);
        #print "<pre>" . var_dump($arr) . "</pre>";
        print "<fieldset><legend>" . ucfirst($item) . "</legend>";
        for ($i=0; $i < count($arr); $i++) {
            $ingredients = json_decode($arr[$i]['food'], true);
            #print var_dump($ingredients);
            $details = "<div>&nbsp;&nbsp;&nbsp;&nbsp;<h4 class='h4'>" . count($ingredients['qty']) . " Ingredients</h4></div>\n";
            for ($j=0; $j < count($ingredients['qty']); $j++)  {
                $details .= $ingredients['qty'][$j] . $ingredients['measure'][$j] . " " . $ingredients['ingredients'][$j] . "<br \>\n";
            }
            $instructions = $details . "<br \><h4 class='h4'>Home</h4><br \>\n" . $arr[$i]['home'] . "\n<br \><h4 class='h4'>Trail</h4><br \>\n" . $arr[$i]['trail'];
            print "<div class='tooltip'>" . $arr[$i]['name'] . "<span class='foodtext'>" . $instructions . "</span></div><br \>\n";
        }
        print "</fieldset>";
    }
    unset($item);
    #print "count is " . count($grr[0]) . "<br\>";
    #print $grr[0][0] . "<br \>";

    #recurseIt($grr);
    print '</fieldset>';
    print $footer;    
}
else {
    $result = "Not post";
}


function test_input($data)  {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data);
    return $data;
}

function recurseIt ($array) {
    foreach ($array as $key => $vals) {
        #print $vals['name'] . "<br \>";
        print "key is " . $key . " and val is " .$vals . "<br \>";
        recurseIt($key);
    }   
} 

?>
